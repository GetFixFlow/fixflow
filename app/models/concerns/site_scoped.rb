# Hides what is in another site from a person who works at some sites (see SiteAccess). The list of hidden places is set for a
# request in Current.hidden_location_ids and is empty (nothing hidden) everywhere else: jobs, the public API, the console.
#
#   by: :location  the record has a place (an asset, a part): hidden when its place is hidden; one with no place is shared
#   by: :asset     it hangs off an asset: hidden when the asset is
#   by: :asset_or_none  like :asset, but one with no asset is shared (a work order about nothing in particular)
#   by: :self      it is a place: hidden when it is
module SiteScoped
  extend ActiveSupport::Concern

  class_methods do
    # Also refuses to point a record at something hidden: the company check (SameCompanyReferences) looks records up past every scope,
    # so without this a work order could be put on another site's asset by its number.
    def hidden_by_site(by:)
      refuse_hidden_references(by)
      default_scope do
        hidden = Current.hidden_location_ids
        next all if hidden.blank?

        table = quoted_table_name
        case by
        when :location then where("#{table}.location_id IS NULL OR #{table}.location_id NOT IN (?)", hidden)
        when :asset then where(asset_id: Asset.select(:id))
        when :asset_or_none then where("#{table}.asset_id IS NULL OR #{table}.asset_id IN (?)", Asset.select(:id))
        when :self then where.not(id: hidden)
        end
      end
    end

    private

    def refuse_hidden_references(by)
      case by
      when :asset, :asset_or_none
        validate(if: -> { Current.hidden_location_ids.present? && asset_id.present? && will_save_change_to_asset_id? }) do
          errors.add(:asset, "is not at one of your sites") unless Asset.exists?(asset_id)
        end
      when :location
        validate(if: -> { Current.hidden_location_ids.present? && location_id.present? && will_save_change_to_location_id? }) do
          errors.add(:location, "is not at one of your sites") unless Location.exists?(location_id)
        end
      end
    end
  end
end
