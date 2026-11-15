require "rails_helper"

RSpec.describe Ai::Providers::OpenAiCompatible do
  let(:address) { "https://api.example.com/v1" }
  let(:config) do
    AiConfig.new(provider: "openai_compatible").tap do |c|
      c.setting("openai_compatible").base_url = address
      c.setting("openai_compatible").model = "gpt-x"
      c.setting("openai_compatible").api_key = "sk-oa-SECRET"
    end
  end
  let(:url) { "https://api.example.com/v1/chat/completions" }
  let(:messages) { [{ role: "user", content: "Hi" }] }

  before { allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"]) }

  def answer(text) = { choices: [{ message: { role: "assistant", content: text } }] }.to_json

  def ok(text) = { status: 200, headers: { "Content-Type" => "application/json" }, body: answer(text) }

  def events(*deltas)
    "#{deltas.map { |delta| "data: #{{ choices: [{ delta: { content: delta } }] }.to_json}\n\n" }.join}data: [DONE]\n\n"
  end

  describe "#chat" do
    it "asks the chat API and returns the text, sending the key, the model and the system prompt" do
      stub = stub_request(:post, url)
             .with(headers: { "Authorization" => "Bearer sk-oa-SECRET", "Content-Type" => "application/json" }) { |request|
               body = JSON.parse(request.body)
               body["model"] == "gpt-x" && body["stream"] == false && body["max_tokens"] == 50 &&
                 body["messages"] == [{ "role" => "system", "content" => "Be brief" }, { "role" => "user", "content" => "Hi" }]
             }.to_return(ok("Hello"))

      expect(described_class.new(config).chat(messages: messages, system: "Be brief", max_tokens: 50)).to eq("Hello")
      expect(stub).to have_been_requested
    end

    it "lets a call name another model" do
      stub = stub_request(:post, url).with { |request| JSON.parse(request.body)["model"] == "other" }.to_return(ok("x"))

      described_class.new(config).chat(messages: messages, model: "other")

      expect(stub).to have_been_requested
    end

    it "sends no login when there is no key (a local model usually has none)" do
      config.setting("openai_compatible").api_key = nil
      stub = stub_request(:post, url).with { |request| !request.headers.key?("Authorization") }.to_return(ok("Hello"))

      described_class.new(config).chat(messages: messages)

      expect(stub).to have_been_requested
    end

    it "keeps a trailing slash on the address from making a double slash" do
      config.setting("openai_compatible").base_url = "https://api.example.com/v1/"
      stub_request(:post, url).to_return(ok("Hello"))

      expect(described_class.new(config).chat(messages: messages)).to eq("Hello")
    end

    it "tries again with max_completion_tokens when the service insists on that name (newer OpenAI models)" do
      refusal = { error: { message: "Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead." } }
      stub_request(:post, url).with { |r| JSON.parse(r.body).key?("max_tokens") }.to_return(status: 400, body: refusal.to_json)
      retry_stub = stub_request(:post, url)
                   .with { |r| (b = JSON.parse(r.body)) && b["max_completion_tokens"] == 77 && !b.key?("max_tokens") }
                   .to_return(ok("Hello"))

      expect(described_class.new(config).chat(messages: messages, max_tokens: 77)).to eq("Hello")
      expect(retry_stub).to have_been_requested.once
    end

    it "does not ask a third time" do
      stub_request(:post, url).to_return(status: 400, body: { error: { message: "use max_completion_tokens" } }.to_json)

      expect { described_class.new(config).chat(messages: messages) }.to raise_error(Ai::Client::Error, /refused the request \(400\)/)
      expect(WebMock).to have_requested(:post, url).twice
    end

    describe "when it goes wrong, the message says what to do and never shows the key" do
      def fails(status, body = "") = stub_request(:post, url).to_return(status: status, body: body)

      def error_for(status, body = "")
        fails(status, body)
        described_class.new(config).chat(messages: messages)
      rescue Ai::Client::Error => e
        e
      end

      it "names a refused key" do
        expect(error_for(401, { error: { message: "Incorrect API key provided: sk-oa-SECRET" } }.to_json).message)
          .to eq("api.example.com did not accept the key.")
        expect(error_for(403).message).to eq("api.example.com did not accept the key.")
      end

      it "says what the service said for a refused request, with the key taken out of it" do
        message = error_for(404, { error: { message: "The model gpt-x does not exist (key sk-oa-SECRET)" } }.to_json).message

        expect(message).to eq("api.example.com refused the request (404): The model gpt-x does not exist (key …).")
      end

      it "copes with an error that is a plain string, or not JSON at all" do
        expect(error_for(422, { error: "bad thing" }.to_json).message).to eq("api.example.com refused the request (422): bad thing.")
        expect(error_for(422, "<html>nope</html>").message).to eq("api.example.com refused the request (422).")
      end

      it "names the busy and the broken cases" do
        expect(error_for(429).message).to include("busy or the limit was reached")
        expect(error_for(503).message).to eq("api.example.com had a problem (503).")
      end

      it "does not follow a redirect, which would carry the key along" do
        stub_request(:post, url).to_return(status: 302, headers: { "Location" => "https://evil.example.com/steal" })

        expect { described_class.new(config).chat(messages: messages) }.to raise_error(Ai::Client::Error, /redirected the request/)
        expect(WebMock).not_to have_requested(:any, /evil/)
      end

      it "names a timeout, a service that is not running, an unreachable host and a bad certificate" do
        stub_request(:post, url).to_timeout
        expect { described_class.new(config).chat(messages: messages) }
          .to raise_error(Ai::Client::TimeoutError, /did not answer in time/)

        stub_request(:post, url).to_raise(Errno::ECONNREFUSED)
        expect { described_class.new(config).chat(messages: messages) }
          .to raise_error(Ai::Client::Error, /Nothing is answering at api.example.com/)

        stub_request(:post, url).to_raise(SocketError)
        expect { described_class.new(config).chat(messages: messages) }.to raise_error(Ai::Client::Error, /could not be reached/)

        stub_request(:post, url).to_raise(OpenSSL::SSL::SSLError.new("certificate verify failed"))
        expect { described_class.new(config).chat(messages: messages) }
          .to raise_error(Ai::Client::Error, /secure connection to api.example.com failed \(certificate verify failed\)/)
      end

      it "says so when the service does not answer like an OpenAI-compatible one" do
        stub_request(:post, url).to_return(status: 200, body: "<html>welcome</html>")

        expect { described_class.new(config).chat(messages: messages) }.to raise_error(Ai::Client::Error, /did not answer the way/)
      end
    end

    it "refuses, without sending anything, when the name now points somewhere it may not" do
      allow(Resolv).to receive(:getaddresses).and_return(["10.0.0.5"])

      expect { described_class.new(config).chat(messages: messages) }.to raise_error(Ai::Client::Error, /private network/)
      expect(WebMock).not_to have_requested(:any, /example/)
    end

    it "says nothing is answering when no address can be connected to" do
      allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10", "203.0.113.11"])
      allow(Net::HTTP).to receive(:new).and_wrap_original do |original, *args|
        original.call(*args).tap { |http| allow(http).to receive(:request).and_raise(Errno::ECONNREFUSED) }
      end

      expect { described_class.new(config).chat(messages: messages) }.to raise_error(Ai::Client::Error, /Nothing is answering/)
    end

    it "does not go on to the next address once one has answered, even with an error (the same words must not be sent twice)" do
      allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10", "203.0.113.11"])
      stub_request(:post, url).to_return(status: 503)

      expect { described_class.new(config).chat(messages: messages) }.to raise_error(Ai::Client::Error, /had a problem \(503\)/)
      expect(WebMock).to have_requested(:post, url).once
    end

    describe "how long it waits for an answer" do
      def read_timeout_for(provider_config)
        waited = []
        allow(Net::HTTP).to receive(:new).and_wrap_original do |original, *args|
          original.call(*args).tap do |http|
            allow(http).to receive(:request) do
              waited << http.read_timeout
              raise Errno::ECONNREFUSED
            end
          end
        end
        expect { described_class.new(provider_config).chat(messages: messages) }.to raise_error(Ai::Client::Error)
        waited.first
      end

      it "is a minute for a service on the internet" do
        allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"])

        expect(read_timeout_for(config)).to eq(described_class::READ_TIMEOUT)
      end

      it "is two minutes for a model run locally, which can be slow to load" do
        allow(Resolv).to receive(:getaddresses).and_return(["192.168.1.20"])
        local = AiConfig.new(provider: "local").tap { |c| c.setting("local").base_url = "http://192.168.1.20:11434/v1" }

        expect(read_timeout_for(local)).to eq(described_class::LOCAL_READ_TIMEOUT)
      end
    end

    it "connects to the address that was checked" do
      pinned = []
      allow(Net::HTTP).to receive(:new).and_wrap_original do |original, *args|
        original.call(*args).tap do |http|
          allow(http).to(receive(:ipaddr=).and_wrap_original { |m, ip| m.call(ip).tap { pinned << ip } })
        end
      end
      stub_request(:post, url).to_return(ok("Hello"))

      described_class.new(config).chat(messages: messages)

      expect(pinned).to eq(["203.0.113.10"])
    end
  end

  describe "#stream" do
    it "gives each piece of the answer as it arrives, and returns all of it" do
      stub_request(:post, url).with { |r| JSON.parse(r.body)["stream"] == true }
                              .to_return(status: 200, headers: { "Content-Type" => "text/event-stream" },
                                         body: events("Hel", "lo ", "there"))
      pieces = []

      whole = described_class.new(config).stream(messages: messages) { |piece| pieces << piece }

      expect(pieces).to eq(["Hel", "lo ", "there"])
      expect(whole).to eq("Hello there")
    end

    it "skips pieces with no text (the first one only names the role, the last one ends it)" do
      body = "data: #{{ choices: [{ delta: { role: 'assistant' } }] }.to_json}\n\n" + events("Hi") +
             "data: #{{ choices: [{ delta: {}, finish_reason: 'stop' }] }.to_json}\n\n"
      stub_request(:post, url).to_return(status: 200, headers: { "Content-Type" => "text/event-stream" }, body: body)

      expect(described_class.new(config).stream(messages: messages) { nil }).to eq("Hi")
    end

    it "takes an answer that arrives in one piece from a service that ignored stream: true" do
      stub_request(:post, url).to_return(ok("All at once"))
      pieces = []

      expect(described_class.new(config).stream(messages: messages) { |piece| pieces << piece }).to eq("All at once")
      expect(pieces).to eq(["All at once"])
    end

    it "stops with the service's words when it reports an error in the middle of the answer" do
      body = events("Hi").sub("data: [DONE]\n\n", "") + "data: #{{ error: { message: 'out of memory' } }.to_json}\n\n"
      stub_request(:post, url).to_return(status: 200, headers: { "Content-Type" => "text/event-stream" }, body: body)

      expect { described_class.new(config).stream(messages: messages) { nil } }
        .to raise_error(Ai::Client::Error, "api.example.com stopped with an error: out of memory")
    end

    it "ignores comment lines and keep-alives, and an unfinished last line" do
      unfinished = "data: #{{ choices: [{ delta: { content: '!' } }] }.to_json}" # no newline at the end
      body = ": keep-alive\n\nevent: ping\n\n#{events('Hi').sub("data: [DONE]\n\n", '')}#{unfinished}"
      stub_request(:post, url).to_return(status: 200, headers: { "Content-Type" => "text/event-stream" }, body: body)

      expect(described_class.new(config).stream(messages: messages) { nil }).to eq("Hi!")
    end
  end

  # A real server on this machine, for what WebMock cannot show: an answer cut into pieces in the middle of a line and of a letter.
  describe "talking to a real local model (a server on this machine, answering in pieces)" do
    let(:server) { TCPServer.new("127.0.0.1", 0) }
    let(:port) { server.addr[1] }
    let(:received) { [] } # what the server was sent, written by the thread that answers
    let(:config) do
      AiConfig.new(provider: "local").tap do |c|
        c.setting("local").base_url = "http://127.0.0.1:#{port}/v1"
        c.setting("local").model = "llama3"
      end
    end

    def serve(pieces, headers: "Content-Type: text/event-stream")
      Thread.new do
        socket = server.accept
        request = +""
        request << socket.readpartial(4096) until request.include?("\r\n\r\n") && body_complete?(request)
        received << request
        socket.write("HTTP/1.1 200 OK\r\n#{headers}\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n")
        pieces.each do |piece|
          socket.write("#{piece.bytesize.to_s(16)}\r\n#{piece}\r\n")
          socket.flush
          sleep 0.02
        end
        socket.write("0\r\n\r\n")
        socket.close
      end
    end

    def body_complete?(request)
      head, body = request.split("\r\n\r\n", 2)
      length = head[/content-length: (\d+)/i, 1].to_i
      body.to_s.bytesize >= length
    end

    after { server.close }

    it "reaches a program that listens on IPv4 only when the name's first address is IPv6 (localhost on many machines)" do
      allow(Resolv).to receive(:getaddresses).with("localhost").and_return(["::1", "127.0.0.1"])
      config.setting("local").base_url = "http://localhost:#{port}/v1"
      thread = serve(["data: #{{ choices: [{ delta: { content: 'Hello' } }] }.to_json}\n\n".b, "data: [DONE]\n\n".b])

      whole = described_class.new(config).stream(messages: [{ role: "user", content: "Hi" }]) { nil }
      thread.join

      expect(whole).to eq("Hello")
      expect(received.first).to include("Host: localhost:#{port}")
    end

    it "puts the pieces back together across line and letter boundaries" do
      line = "data: #{{ choices: [{ delta: { content: 'Grüße, 世界' } }] }.to_json}\n\n"
      bytes = line.b
      cut = bytes.index("ü".b) + 1 # in the middle of the two bytes of ü
      thread = serve([bytes[0, 10], bytes[10...cut], bytes[cut..], "data: [DONE]\n\n".b])
      pieces = []

      whole = described_class.new(config).stream(messages: [{ role: "user", content: "Hi" }]) { |piece| pieces << piece }
      thread.join

      expect(whole).to eq("Grüße, 世界")
      expect(pieces).to eq(["Grüße, 世界"])
      expect(received.first).to include("POST /v1/chat/completions")
      expect(received.first).not_to match(/authorization/i)
    end
  end
end
