class CreateSketchObjects < ActiveRecord::Migration[7.1]
  def change
    create_table :sketch_objects, id: :string do |t|
      t.string :thred_id, null: false
      t.string :operation_id, null: false
      t.string :object_type, null: false
      t.text :data, null: false
      t.timestamps
    end

    add_index :sketch_objects, [:thred_id, :operation_id], unique: true
    add_index :sketch_objects, [:thred_id, :created_at]
    add_foreign_key :sketch_objects, :threds, column: :thred_id, on_delete: :cascade
  end
end
