class CreateGridTables < ActiveRecord::Migration[7.1]
  def change
    create_table :grid_items, id: :string do |t|
      t.string :subject, null: false, limit: 120
      t.string :access, null: false, default: "public"
      t.string :key_salt
      t.string :key_digest
      t.integer :max_rows, null: false, default: 500
      t.integer :max_columns, null: false, default: 500
      t.timestamps null: false
    end

    add_check_constraint :grid_items,
                         "access IN ('public', 'keyed')",
                         name: "grid_items_access_valid"
    add_check_constraint :grid_items,
                         "max_rows BETWEEN 1 AND 500 AND max_columns BETWEEN 1 AND 500",
                         name: "grid_items_dimensions_valid"
    add_check_constraint :grid_items,
                         "(access = 'public' AND key_salt IS NULL AND key_digest IS NULL) OR " \
                         "(access = 'keyed' AND key_salt IS NOT NULL AND key_digest IS NOT NULL)",
                         name: "grid_items_key_valid"
    add_index :grid_items, :updated_at

    create_table :grid_cells do |t|
      t.references :grid_item, type: :string, null: false, foreign_key: { on_delete: :cascade }
      t.integer :row_index, null: false
      t.integer :column_index, null: false
      t.timestamps null: false
    end

    add_check_constraint :grid_cells,
                         "row_index BETWEEN 1 AND 500 AND column_index BETWEEN 1 AND 500",
                         name: "grid_cells_coordinates_valid"
    add_index :grid_cells, %i[grid_item_id row_index column_index], unique: true,
              name: "index_grid_cells_on_item_and_position"

    create_table :grid_posts, id: :string do |t|
      t.references :grid_cell, null: false, foreign_key: { on_delete: :cascade }
      t.text :content, null: false, limit: 2000
      t.datetime :created_at, null: false
    end

    add_check_constraint :grid_posts,
                         "length(content) BETWEEN 1 AND 2000",
                         name: "grid_posts_content_length_valid"
    add_index :grid_posts, %i[grid_cell_id created_at id]

    create_table :grid_cell_formats do |t|
      t.references :grid_item, type: :string, null: false, foreign_key: { on_delete: :cascade }
      t.integer :row_index, null: false
      t.integer :column_index, null: false
      t.boolean :bold, null: false, default: false
      t.string :color
      t.timestamps null: false
    end

    add_check_constraint :grid_cell_formats,
                         "row_index BETWEEN 1 AND 500 AND column_index BETWEEN 1 AND 500",
                         name: "grid_cell_formats_coordinates_valid"
    add_check_constraint :grid_cell_formats,
                         "color IS NULL OR color IN ('slate', 'rose', 'amber', 'emerald', 'sky', 'violet')",
                         name: "grid_cell_formats_color_valid"
    add_index :grid_cell_formats, %i[grid_item_id row_index column_index], unique: true,
              name: "index_grid_cell_formats_on_item_and_position"
  end
end
