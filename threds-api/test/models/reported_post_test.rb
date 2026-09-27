require "test_helper"

class ReportedPostTest < ActiveSupport::TestCase
  test "creates a reported post record with all required metadata" do
    thred = Thred.create!(
      id: SecureRandom.uuid,
      board_type: "w",
      subject: "Thread subject",
      timestamp: (Time.now.to_f * 1000).to_i
    )

    post = thred.posts.create!(
      id: SecureRandom.uuid,
      content: "This is the reported content",
      author: "Anonymous",
      timestamp: (Time.now.to_f * 1000).to_i
    )

    report = ReportedPost.create!(
      thred_id: thred.id,
      post_id: post.id,
      post_content: post.content,
      report_reason: "inappropriate",
      reported_at: Time.current
    )

    assert_equal thred.id, report.thred_id
    assert_equal post.id, report.post_id
    assert_equal "inappropriate", report.report_reason
    assert_equal post.content, report.post_content
    assert_not_nil report.reported_at
  end
end
