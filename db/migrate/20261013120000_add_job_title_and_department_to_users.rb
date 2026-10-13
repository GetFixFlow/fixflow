class AddJobTitleAndDepartmentToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :job_title, :string
    add_column :users, :department, :string
  end
end
