# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.1].define(version: 2026_11_07_000000) do
  create_table "grid_cell_formats", force: :cascade do |t|
    t.string "grid_item_id", null: false
    t.integer "row_index", null: false
    t.integer "column_index", null: false
    t.boolean "bold", default: false, null: false
    t.string "color"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["grid_item_id", "row_index", "column_index"], name: "index_grid_cell_formats_on_item_and_position", unique: true
    t.index ["grid_item_id"], name: "index_grid_cell_formats_on_grid_item_id"
    t.check_constraint "color IS NULL OR color IN ('slate', 'rose', 'amber', 'emerald', 'sky', 'violet')", name: "grid_cell_formats_color_valid"
    t.check_constraint "row_index BETWEEN 1 AND 500 AND column_index BETWEEN 1 AND 500", name: "grid_cell_formats_coordinates_valid"
  end

  create_table "grid_cells", force: :cascade do |t|
    t.string "grid_item_id", null: false
    t.integer "row_index", null: false
    t.integer "column_index", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["grid_item_id", "row_index", "column_index"], name: "index_grid_cells_on_item_and_position", unique: true
    t.index ["grid_item_id"], name: "index_grid_cells_on_grid_item_id"
    t.check_constraint "row_index BETWEEN 1 AND 500 AND column_index BETWEEN 1 AND 500", name: "grid_cells_coordinates_valid"
  end

  create_table "grid_posts", id: :string, force: :cascade do |t|
    t.integer "grid_cell_id", null: false
    t.text "content", limit: 2000, null: false
    t.datetime "created_at", null: false
    t.index ["grid_cell_id", "created_at", "id"], name: "index_grid_posts_on_grid_cell_id_and_created_at_and_id"
    t.index ["grid_cell_id"], name: "index_grid_posts_on_grid_cell_id"
    t.check_constraint "length(content) BETWEEN 1 AND 2000", name: "grid_posts_content_length_valid"
  end

  create_table "grid_threds", id: :string, force: :cascade do |t|
    t.string "subject", limit: 120, null: false
    t.string "access", default: "public", null: false
    t.string "key_salt"
    t.string "key_digest"
    t.integer "max_rows", default: 500, null: false
    t.integer "max_columns", default: 500, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["updated_at"], name: "index_grid_threds_on_updated_at"
    t.check_constraint "(access = 'public' AND key_salt IS NULL AND key_digest IS NULL) OR (access = 'keyed' AND key_salt IS NOT NULL AND key_digest IS NOT NULL)", name: "grid_items_key_valid"
    t.check_constraint "access IN ('public', 'keyed')", name: "grid_items_access_valid"
    t.check_constraint "max_rows BETWEEN 1 AND 500 AND max_columns BETWEEN 1 AND 500", name: "grid_items_dimensions_valid"
  end

  create_table "posts", id: :string, force: :cascade do |t|
    t.string "thred_id", null: false
    t.string "author", default: "Anonymous"
    t.text "content"
    t.bigint "timestamp", null: false
    t.string "image_url"
    t.string "reply_to_id"
    t.string "author_ip", limit: 45
    t.index ["author_ip"], name: "index_posts_on_author_ip"
    t.index ["thred_id"], name: "index_posts_on_thred_id"
  end

  create_table "reported_posts", id: :string, force: :cascade do |t|
    t.string "thred_id", null: false
    t.string "post_id", null: false
    t.text "post_content", null: false
    t.string "report_reason", null: false
    t.text "custom_reason"
    t.datetime "reported_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["post_id"], name: "index_reported_posts_on_post_id"
    t.index ["thred_id"], name: "index_reported_posts_on_thred_id"
  end

  create_table "threds", id: :string, force: :cascade do |t|
    t.string "board_type", null: false
    t.string "subject", null: false
    t.bigint "timestamp", null: false
    t.string "protection_status", default: "public", null: false
    t.string "thread_code_salt"
    t.string "thread_code_digest"
  end

  add_foreign_key "grid_cell_formats", "grid_threds", column: "grid_item_id", on_delete: :cascade
  add_foreign_key "grid_cells", "grid_threds", column: "grid_item_id", on_delete: :cascade
  add_foreign_key "grid_posts", "grid_cells", on_delete: :cascade
end
