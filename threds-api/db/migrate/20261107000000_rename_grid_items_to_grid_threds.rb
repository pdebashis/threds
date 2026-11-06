class RenameGridItemsToGridThreds < ActiveRecord::Migration[7.1]
  def change
    rename_table :grid_items, :grid_threds
  end
end
