# Records of one company must not point at records of another: a work order on another company's machine would show the
# machine's name to the wrong people. `same_company_only :asset` checks the record the association points at belongs to this
# company. (It looks the record up without the tenant scope: inside it, another company's record simply is not found, and
# the id would go unchecked.)
module SameCompanyReferences
  extend ActiveSupport::Concern

  class_methods do
    def same_company_only(*names)
      names.each do |name|
        key = reflect_on_association(name).foreign_key
        klass = reflect_on_association(name).klass
        validate(if: -> { self[key].present? }) do
          owner = klass.unscoped.where(id: self[key]).pick(:organization_id)
          errors.add(name, "must belong to the same organization") unless owner == organization_id
        end
      end
    end
  end
end
