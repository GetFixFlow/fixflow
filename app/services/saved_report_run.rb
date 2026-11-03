# Makes the PDF of a saved report, as the person who saved it, with the same code that answers the Reports screen's
# Export menu: the report's own controller action, asked for the same filters and the dates the period means today.
# Nothing is signed in or logged as a sign-in; the action just runs as that person, so it applies the same rules (managers
# only, the company's time zone, a company that requires two-factor) and cannot show more than the screen would.
class SavedReportRun
  class Failed < StandardError; end

  Result = Struct.new(:filename, :pdf, :from, :to)

  def initialize(saved_report, today: nil)
    @saved = saved_report
    @today = today
  end

  def call
    person = @saved.user
    unless person.active? && person.manager_or_above?
      raise Failed,
"#{person.full_name} is no longer a manager, so the report cannot be made as them."
    end

    org = @saved.organization
    # The report's controller sets who is signed in and which company is current; both are put back as they were.
    Current.set(user: person, request_ip: nil) { ActsAsTenant.with_tenant(org) { run(person, org) } }
  end

  private

  def run(person, org)
    today = @today || Time.use_zone(org.timezone_or_default) { Time.zone.today }
    query = @saved.query_for(today)
    spec = SavedReport::REPORTS.fetch(@saved.report)

    response = dispatch(spec, query, person)
    raise Failed, failure_reason(response) unless response.status == 200 && response.media_type == "application/pdf"

    from, to = SavedReport.range_for(@saved.period, today)
    Result.new("#{spec[:path].tr('/', '_')}_#{to.iso8601}.pdf", response.body, from, to)
  end

  def dispatch(spec, query, person)
    controller_class = spec[:controller].constantize
    env = Rack::MockRequest.env_for("/api/v1/reports/#{spec[:path]}.pdf?#{query.to_query}", "REMOTE_ADDR" => "127.0.0.1")
    request = ActionDispatch::Request.new(env)
    request.path_parameters = { controller: controller_class.controller_path, action: spec[:action], format: "pdf" }
    response = controller_class.make_response!(request)
    controller = controller_class.new
    controller.singleton_class.prepend(signed_in_as(person))
    controller.dispatch(spec[:action], request, response)
    response
  end

  # The controller asks Devise who is signed in; here it is the person who saved the report.
  def signed_in_as(person)
    Module.new do
      define_method(:authenticate_user!) { |*| true }
      define_method(:current_user) { person }
      define_method(:user_signed_in?) { true }
    end
  end

  def failure_reason(response)
    message = JSON.parse(response.body).dig("error", "message") rescue nil # rubocop:disable Style/RescueModifier
    "The report could not be made#{": #{message}" if message} (status #{response.status})."
  end
end
