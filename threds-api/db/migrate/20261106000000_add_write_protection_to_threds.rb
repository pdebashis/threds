class AddWriteProtectionToThreds < ActiveRecord::Migration[7.1]
  def change
    add_column :threds, :protection_status, :string, null: false, default: "public"
    add_column :threds, :thread_code_salt, :string
    add_column :threds, :thread_code_digest, :string
  end
end
