module Sanitizable
  extend ActiveSupport::Concern

  included do
    before_validation :strip_string_attributes
  end

  private

  def strip_string_attributes
    self.class.columns
        .select { |c| c.type == :string || c.type == :text }
        .map(&:name)
        .each do |attr|
          value = self[attr]
          # Array columns (e.g. api_keys.scopes) also report type :string; only strip real strings.
          self[attr] = value.strip if value.is_a?(String)
        end
  end
end
