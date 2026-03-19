class CreateThreds < ActiveRecord::Migration[7.1]
  def change
    create_table :threds, id: :string do |t|
      t.string :board_type, null: false   # work | random | travel
      t.string :subject, null: false
      t.bigint :timestamp, null: false
    end
  end
end