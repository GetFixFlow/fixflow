# Takes sample data out again (see SampleDataService), leaving anything real alone.
#
# Removing a record removes what hangs off it, so before each one is removed it is checked that nothing the
# company made themselves depends on it. If something does, the record is kept (and reported), and so is
# whatever it hangs off in turn.
class SampleDataRemoval
  # Dependants first: work orders, then the schedules and assets they belong to, then parts and places.
  ORDER = %w[WorkOrder PreventiveMaintenance Asset Part Location].freeze

  def initialize(organization)
    @organization = organization
    @kept_ids = Hash.new { |hash, type| hash[type] = [] }
  end

  # { removed: { "Asset" => 5, ... }, kept: [ { type:, name:, reason: } ] }
  def call
    removed = Hash.new(0)
    kept = []
    ActsAsTenant.with_tenant(@organization) do
      ORDER.each { |type| records_of(type).each { |record| handle(record, type, removed, kept) } }
      # What was kept is the company's own now: it is no longer sample data.
      SampleRecord.where(organization: @organization).delete_all
    end
    { removed: removed, kept: kept }
  end

  private

  def handle(record, type, removed, kept)
    reason = reason_to_keep(record)
    if reason
      kept << { type: type, name: record.try(:name) || record.try(:title), reason: reason }
      @kept_ids[type] << record.id
    else
      destroy(record)
      removed[type] += 1
    end
  end

  def sample_ids(type) = SampleRecord.ids_of(type, @organization)

  def records_of(type)
    scope = type.constantize.where(id: sample_ids(type))
    # Deepest places first, so a place is only looked at once what is inside it has been dealt with.
    type == "Location" ? scope.sort_by { |location| -location.depth } : scope.to_a
  end

  # Why this record has to stay, if it does: something real now depends on it.
  def reason_to_keep(record)
    case record
    when PreventiveMaintenance then schedule_in_use(record)
    when Asset then asset_in_use(record)
    when Part then part_in_use(record)
    when Location then location_in_use(record)
    end
  end

  def schedule_in_use(schedule)
    return unless WorkOrder.where(preventive_maintenance_id: schedule.id).where.not(id: sample_ids("WorkOrder")).exists?

    "work orders you created use this schedule"
  end

  def asset_in_use(asset)
    own_work = WorkOrder.where(asset_id: asset.id).where.not(id: sample_ids("WorkOrder")).exists?
    schedules = PreventiveMaintenance.where(asset_id: asset.id)
    # Removing an asset removes its schedules, so a schedule that was kept keeps its asset too.
    kept = schedules.where(id: @kept_ids["PreventiveMaintenance"])
    real_or_kept = schedules.where.not(id: sample_ids("PreventiveMaintenance")).or(kept)
    own_schedules = real_or_kept.exists?
    "work orders or schedules you created use this asset" if own_work || own_schedules
  end

  def part_in_use(part)
    return unless WorkOrderPart.where(part_id: part.id).where.not(work_order_id: sample_ids("WorkOrder")).exists?

    "it has been used on work orders you created"
  end

  # Removing a place removes what is inside it, so a place stays if anything real is in it, or anything below
  # it was kept (which keeps the places above that too, one by one, as the deepest are looked at first).
  def location_in_use(location)
    below = location.descendants
    in_it = Asset.exists?(location_id: location.id) || Part.exists?(location_id: location.id)
    return unless in_it || below.where.not(id: sample_ids("Location")).or(below.where(id: @kept_ids["Location"])).exists?

    "assets, parts or places you added are in it"
  end

  def destroy(record)
    PmExecution.where(work_order_id: record.id).destroy_all if record.is_a?(WorkOrder)
    record.destroy!
  end
end
