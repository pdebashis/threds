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

ActiveRecord::Schema[7.1].define(version: 2026_09_27_120000) do
  create_table "posts", id: :string, force: :cascade do |t|
    t.string "thred_id", null: false
    t.string "author", default: "Anonymous"
    t.text "content"
    t.bigint "timestamp", null: false
    t.string "image_url"
    t.string "reply_to_id"
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
  end

end
