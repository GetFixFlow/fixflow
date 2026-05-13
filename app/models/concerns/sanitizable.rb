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
        .each { |attr| self[attr] = self[attr]&.strip }
  end
end
