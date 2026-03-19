class CreatePosts < ActiveRecord::Migration[7.1]
  def change
    create_table :posts, id: :string do |t|
      t.string :thred_id, null: false
      t.string :author, default: "Anonymous"
      t.text :content
      t.bigint :timestamp, null: false
      t.string :image_url
      t.string :reply_to_id

      t.index :thred_id
    end
  end
end