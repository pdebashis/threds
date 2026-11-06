require "openssl"

class Thred < ApplicationRecord
  self.primary_key = "id"

  PROTECTION_STATUSES = %w[public code_protected].freeze
  THREAD_CODE_ITERATIONS = 120_000

  # Both columns are NOT NULL in the database. Without this the controller would
  # raise a constraint violation and return a 500 instead of a validation error.
  validates :subject, presence: true
  validates :board_type, presence: true
  validates :protection_status, inclusion: { in: PROTECTION_STATUSES }

  has_many :posts, foreign_key: "thred_id"

  validate :thread_code_required_for_protected_threds

  def set_thread_code(code)
    self.thread_code_salt = SecureRandom.hex(16)
    self.thread_code_digest = derive_thread_code_digest(code, thread_code_salt)
  end

  def accepts_post_key?(code)
    return true unless protection_status == "code_protected"
    return false if code.blank? || thread_code_salt.blank? || thread_code_digest.blank?

    ActiveSupport::SecurityUtils.secure_compare(
      thread_code_digest,
      derive_thread_code_digest(code, thread_code_salt)
    )
  end

  private

  def thread_code_required_for_protected_threds
    return unless protection_status == "code_protected"
    return if thread_code_salt.present? && thread_code_digest.present?

    errors.add(:base, "A thred key is required for keyed threds")
  end

  def derive_thread_code_digest(code, salt)
    OpenSSL::KDF.pbkdf2_hmac(
      code,
      salt: salt,
      iterations: THREAD_CODE_ITERATIONS,
      length: 32,
      hash: "sha256"
    ).unpack1("H*")
  end
end
