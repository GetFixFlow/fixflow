# The language a person chose for themselves (nil: use the company's). It decides the language of the emails they are
# sent and of the messages the server writes for them.
class AddLocaleToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :locale, :string
  end
end
