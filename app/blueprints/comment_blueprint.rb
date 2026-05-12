class CommentBlueprint < Blueprinter::Base
  identifier :id
  fields :body, :internal, :created_at

  field(:user) do |comment|
    { id: comment.user.id, full_name: comment.user.full_name, role: comment.user.role }
  end
end
