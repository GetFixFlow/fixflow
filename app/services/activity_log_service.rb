class ActivityLogService
  def self.log(action:, resource:, user: Current.user, metadata: {}, request: nil)
    org_id = org_id_for(resource)
    return unless org_id

    ActivityLog.create!(
      organization_id: org_id,
      user:            user,
      action:          action,
      resource_type:   resource.class.name,
      resource_id:     resource.id,
      resource_name:   name_for(resource),
      metadata:        metadata,
      ip_address:      ip_from(request) || Current.request_ip
    )
  rescue => e
    Rails.logger.warn "[ActivityLog] Failed to log #{action}: #{e.message}"
  end

  private_class_method def self.org_id_for(resource)
    if resource.respond_to?(:organization_id)
      resource.organization_id
    elsif resource.respond_to?(:organization)
      resource.organization&.id
    end
  end

  private_class_method def self.name_for(resource)
    %i[work_order_number name title].each do |attr|
      return resource.public_send(attr).to_s if resource.respond_to?(attr)
    end
    "#{resource.class.name} ##{resource.id}"
  end

  private_class_method def self.ip_from(request)
    request&.remote_ip
  end
end
