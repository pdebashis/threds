class DropGridTables < ActiveRecord::Migration[7.1]
  def up
    drop_table :grid_cell_formats, if_exists: true
    drop_table :grid_posts, if_exists: true
    drop_table :grid_cells, if_exists: true
    drop_table :grid_threds, if_exists: true
    drop_table :grid_items, if_exists: true
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "Grid table data has been deleted"
  end
end
