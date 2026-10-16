require "rails_helper"
require "tmpdir"

# apps/web/scripts/list-api-calls.mjs reads the web app's requests from its source. These run it on small sample files.
RSpec.describe "list-api-calls.mjs" do # rubocop:disable RSpec/DescribeClass
  let(:script) { Rails.root.join("apps/web/scripts/list-api-calls.mjs").to_s }

  before { skip "Node is not installed" unless system("node", "--version", out: File::NULL, err: File::NULL) }

  def calls_in(files)
    Dir.mktmpdir do |dir|
      files.each do |name, code|
        path = File.join(dir, name)
        FileUtils.mkdir_p(File.dirname(path))
        File.write(path, code)
      end
      # The script finds `typescript` next to the web app, so it runs from there with the sample folder as its argument.
      output = IO.popen(["node", script, dir], err: %i[child out], &:read)
      JSON.parse(output, symbolize_names: true)
    end
  end

  def listed(files) = calls_in(files).map { |c| [c[:verb], c[:path], c[:dynamic]] }

  it "reads a request written as a string, with each variable as :param and any query string left off" do
    code = <<~TS
      export const api = {
        list: () => apiClient.get('/assets'),
        get: (id: number) => apiClient.get(`/assets/${id}`),
        search: (q: string) => apiClient.get(`/assets?search=${q}`),
        child: (id: number, other: number) => apiClient.delete(`/assets/${id}/links/${other}/remove`),
      }
    TS

    expect(listed("api.ts" => code)).to eq([["get", "/assets", false], ["get", "/assets/:param", false],
                                            ["get", "/assets", false], ["delete", "/assets/:param/links/:param/remove", false]])
  end

  it "reads every verb, including one with a type argument that has braces and angle brackets in it" do
    code = <<~TS
      apiClient.get<{ data: Array<{ id: number }> }>('/a')
      apiClient.post<{ ok: boolean }>('/b', { x: 1 })
      apiClient.put('/c')
      apiClient.patch<unknown>('/d', {})
      apiClient.delete('/e')
    TS

    expect(listed("api.ts" => code).map { |verb, path, _|
      [verb, path]
    }).to eq([%w[get /a], %w[post /b], %w[put /c], %w[patch /d], %w[delete /e]])
  end

  it "does not skip a request whose path is not written out: it is listed as dynamic, with no path" do
    code = <<~TS
      const p = '/x'
      apiClient.get(p)
      apiClient.get(`${base}/y`)
      apiClient.post(buildPath())
    TS

    expect(listed("api.ts" => code)).to eq([["get", nil, true], ["get", nil, true], ["post", nil, true]])
  end

  it "ignores things that only look like requests: other objects' get, other clients, text in strings and comments" do
    code = <<~TS
      map.get('/assets')
      cache.delete('/assets')
      otherClient.get('/assets')
      const note = "apiClient.get('/assets')"
      // apiClient.get('/assets')
    TS

    expect(listed("api.ts" => code)).to eq([])
  end

  it "ignores test files and test folders" do
    files = { "a.test.ts" => "apiClient.get('/a')", "__tests__/b.ts" => "apiClient.get('/b')", "test/c.ts" => "apiClient.get('/c')",
              "types.d.ts" => "apiClient.get('/d')", "real.tsx" => "apiClient.get('/real')" }

    expect(listed(files)).to eq([["get", "/real", false]])
  end

  it "reads the address that exportReport('report', 'format') asks for, when both are written out" do
    code = <<~TS
      exportReport('work_orders/summary', 'csv', params)
      exportReport('assets/health', 'pdf')
    TS

    result = calls_in("page.tsx" => code)

    expect(result.map { |c|
      [c[:verb], c[:path], c[:dynamic], c[:via]]
    }).to eq([["get", "/reports/work_orders/summary.csv", false, "exportReport"],
              ["get", "/reports/assets/health.pdf", false,
               "exportReport"]])
  end

  it "does not skip an exportReport call whose report or format is not written out" do
    code = "exportReport(name, 'csv')\nexportReport('a/b', format)\nexportReport('a/b')"

    expect(listed("page.tsx" => code)).to eq([["get", nil, true], ["get", nil, true], ["get", nil, true]])
  end

  it "says where each request is" do
    result = calls_in("src/api/things.ts" => "\n\nexport const a = apiClient.get('/a')\n")

    expect(result.first).to include(file: "src/api/things.ts", line: 3)
  end
end
