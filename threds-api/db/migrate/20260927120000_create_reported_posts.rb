class CreateReportedPosts < ActiveRecord::Migration[7.1]
  def change
    create_table :reported_posts, id: :string do |t|
      t.string :thred_id, null: false
      t.string :post_id, null: false
      t.text :post_content, null: false
      t.string :report_reason, null: false
      t.text :custom_reason
      t.datetime :reported_at, null: false

      t.timestamps
    end

    add_index :reported_posts, :thred_id
    add_index :reported_posts, :post_id
  end
end
