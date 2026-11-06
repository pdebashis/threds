require "openssl"

class GridItem < ApplicationRecord
  self.primary_key = "id"

  ACCESS_TYPES = %w[public keyed].freeze
  MAX_DIMENSION = 500
  KEY_ITERATIONS = 120_000

  has_many :cells, class_name: "GridCell", dependent: :destroy, inverse_of: :grid_item
  has_many :cell_formats, class_name: "GridCellFormat", dependent: :destroy, inverse_of: :grid_item

  before_create :assign_id

  validates :subject, presence: true, length: { maximum: 120 }
  validates :access, inclusion: { in: ACCESS_TYPES }
  validates :max_rows, :max_columns, numericality: { only_integer: true, in: 1..MAX_DIMENSION }
  validate :key_required_for_keyed_items
  validate :public_items_must_not_have_a_key

  def set_access_key(key)
    self.key_salt = SecureRandom.hex(16)
    self.key_digest = derive_key_digest(key, key_salt)
  end

  def accepts_access_key?(key)
    return true unless access == "keyed"
    return false if key.blank? || key_salt.blank? || key_digest.blank?

    ActiveSupport::SecurityUtils.secure_compare(key_digest, derive_key_digest(key, key_salt))
  end

  private

  def assign_id
    self.id ||= SecureRandom.uuid
  end

  def key_required_for_keyed_items
    return unless access == "keyed"
    return if key_salt.present? && key_digest.present?

    errors.add(:base, "A key is required for keyed Grids")
  end

  def public_items_must_not_have_a_key
    return unless access == "public" && (key_salt.present? || key_digest.present?)

    errors.add(:base, "Public Grids cannot have a key")
  end

  def derive_key_digest(key, salt)
    OpenSSL::KDF.pbkdf2_hmac(
      key,
      salt: salt,
      iterations: KEY_ITERATIONS,
      length: 32,
      hash: "sha256"
    ).unpack1("H*")
  end
end
