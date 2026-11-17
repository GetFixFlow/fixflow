# What counts as a break, and the list of them (see spec/support/api_stability.rb).
module ApiStability
  module_function

  def breaks(baseline, current)
    problems = []
    %w[routes environment].each { |name| problems.concat(missing(baseline[name], current[name], name)) }
    %w[events headers].each do |name|
      problems.concat(missing(baseline.dig("webhooks", name), current.dig("webhooks", name), "webhook #{name}"))
    end
    baseline.dig("webhooks", "payloads").each do |name, fields|
      problems.concat(missing(fields, current.dig("webhooks", "payloads", name), "the #{name} sent by a webhook"))
    end
    problems.concat(operation_breaks(baseline["operations"], current["operations"]))
    problems.concat(answer_breaks(baseline["answers"], current["answers"]))
    problems
  end

  def missing(promised, now, what)
    (Array(promised) - Array(now)).map { |item| "#{what}: #{item} is gone" }
  end

  def operation_breaks(promised, now)
    problems = promised.filter_map do |key, entry|
      current = now[key]
      next "#{key} is gone" if current.nil?

      field_breaks(key, entry, current)
    end.flatten
    added = now.reject { |key, _| promised.key?(key) }
    problems + added.filter_map do |key, entry|
      "#{key} is new and required" if entry["required"] && key.match?(/ (request|param) /)
    end
  end

  def field_breaks(key, promised, now)
    problems = []
    problems << "#{key}: was #{promised['type']}, is #{now['type']}" if promised["type"] != now["type"]
    sent_by_client = key.match?(/ (request|param) /)
    if sent_by_client
      problems << "#{key}: is now required" if now["required"] && !promised["required"]
      lost = Array(promised["enum"]) - Array(now["enum"])
      problems << "#{key}: no longer accepts #{lost.join(', ')}" if lost.any? && now["enum"]
    elsif now["nullable"] && !promised["nullable"]
      problems << "#{key}: can now be empty (null)"
    end
    problems
  end

  def answer_breaks(promised, now)
    promised.flat_map do |name, fields|
      current = now[name]
      next ["#{name}: is not answered any more"] if current.nil?

      fields.filter_map do |path, kind|
        if !current.key?(path) then "#{name}: #{path} is gone"
        elsif kind != "null" && current[path] != "null" && kind != current[path]
          "#{name}: #{path} was #{kind}, is #{current[path]}"
        end
      end
    end
  end
end
