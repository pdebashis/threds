class AddAuthorIpToPosts < ActiveRecord::Migration[7.1]
  def change
    # Stored raw so consecutive posting can be limited per client. This is a
    # deliberate tradeoff: the board is anonymous to readers, but the server
    # does retain the originating address for abuse control.
    add_column :posts, :author_ip, :string, limit: 45

    # Serves both the "last post from this IP" lookup and the per-IP purge.
    add_index :posts, :author_ip
  end
end
