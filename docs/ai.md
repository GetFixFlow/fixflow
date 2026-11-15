# AI: choosing a provider, and what it does

FixFlow can use AI to help: the **FixFlow Assist** chat on a work order answers from the asset's history and the text of its manuals, a new work order can **suggest a priority**, and the sensor screens **flag unusual readings**. **AI is off until an administrator picks a provider.** Nothing is sent anywhere before that.

[What it does](#what-it-does) lists each feature and how to switch it off.

Open **Settings → AI** (administrators only) and choose one of four:

| Choice | What it is | Does data leave your network? |
|---|---|---|
| **Off** | No AI. The assistant is hidden | No |
| **Anthropic (Claude)** | Claude, on Anthropic's service. Needs a key from Anthropic | Yes, to Anthropic |
| **OpenAI-compatible service** | OpenAI, OpenRouter, Groq, or any service on the internet that speaks the OpenAI chat API. Needs an address and usually a key | Yes, to that service |
| **Local model** | A model you run yourself, on this server or elsewhere on your own network (Ollama, LM Studio, vLLM, llama.cpp). Usually needs no key | **No**: FixFlow only accepts an address on this server or a private network |

Under the choice, the page says in words where the data goes. Use **Try it** to check the settings before saving them: it asks the model one fixed question (it does not send any work order data) and shows the answer, or the reason it failed, in plain words.

## What it does

Once a provider is chosen, three things are available. Under the provider on **Settings → AI**, a switch for each of the last two lets an administrator turn it off on its own, without losing the provider's settings. They are all on until switched off, and none work while AI is off.

| | What it does | Needs the provider? |
|---|---|---|
| **FixFlow Assist** | A chat on each work order that answers from the asset's history and manuals | Yes |
| **Suggest a priority for new work orders** | A **Suggest a priority** button on the new work order form, once the title is five characters or more. It shows a priority (critical, high, medium or low) with one sentence on why, and a **Use** button. **It never changes the priority by itself**: the person decides | Yes |
| **Flag unusual sensor readings** | A reading far outside what that sensor usually reads is listed on the **IoT Alerts** page, under **Unusual readings**, with what is usual for it. A manager marks it **It's real** or **It's nothing** | **No**: it is arithmetic done on this server |

### Suggested priority

The provider is asked to choose one of the four priorities from what is typed so far and what is already open on the asset. Whatever else it says is thrown away: the screen can only ever show a priority and a short reason, so words typed into a title cannot make it show anything else. A model that answers in words rather than the form asked for is still understood when it names exactly one priority; otherwise the button says it could not read the answer, and the form works as before.

It is a suggestion from a model that has not seen your plant. Treat it as a second opinion, in the way you would a colleague's. The priority a person chooses is the one that is saved, and the audit log records that person's choice as it does today.

### Unusual sensor readings

No limits are set. For each sensor, FixFlow learns what is usual from that sensor's own last two weeks of good readings (up to its latest 2,000), as the **median** and the typical spread around it, and flags a reading that is at least six typical spreads away. The spread used is the median absolute deviation, which a few earlier spikes do not stretch the way an ordinary standard deviation is. The flag shows the range the sensor is usually in (its middle 90%) and how many readings that rests on.

It says nothing, on purpose, when:

- the sensor has **fewer than 60 readings** or they do not reach back **a whole day** (not enough to know what is usual);
- the sensor has **fewer than five different values**: an on/off switch or a status code has no "usual" to be far from;
- the sensor **only ever goes up**, like running hours, or feeds a **meter** (each new reading is "unusual" next to the old ones);
- the reading is marked **bad**, or is **older than an hour** (history being loaded in, not news).

For a sensor that is steady, the spread is never taken as less than 2% of its middle value, so a sensor that always reads 20.0 is not flagged for 20.1. After a flag, the same sensor is not flagged again for six hours, so one fault is one line, not a hundred. A flag does not open a work order and is not an alert: the alert rules above are still what do that. If the company's chat is set up ([Team chat](notifications.md#team-chat)), a flag can be posted there. It is its own event, so a channel whose events were already chosen has to tick it.

It does not use the provider, so it works the same with a local model or a hosted one, and nothing about the readings leaves this server. It is still part of AI: with AI off it is off.

Technicians and above can see the flags (`GET /api/v1/sensor_anomalies`) and a manager can answer them (`PATCH /api/v1/sensor_anomalies/:id/acknowledge` and `/dismiss`); see [the endpoint list](api-endpoints.md).

## What is sent

When someone uses the assistant, FixFlow sends the model that work order's title, description, priority and checklist, the asset's name, tag, location and serial number, the notes of its last five finished work orders, and the text of the first two PDF manuals kept with the asset ([Asset documents](asset-documents.md)), along with what the person has typed in the chat so far. It does not send people's emails, passwords or any key.

When someone asks for a **suggested priority**, FixFlow sends the title and description typed so far (each cut at 1,500 characters), the asset's name, tag and status, and counts of what is open on that asset: work orders by priority, sensor alerts by severity, and unusual readings. No names of people, no email addresses, no costs, and none of the asset's notes or manuals. The unusual-readings feature sends nothing.

## Anthropic (Claude)

Choose **Anthropic**, paste a key from Anthropic's console, and leave **Model** blank to use the default (`claude-sonnet-5-5`) or type the name of another Claude model. The key is sent only to `api.anthropic.com`.

## An OpenAI-compatible service

Choose **OpenAI-compatible service** and fill in:

- **Address**: the service's address, ending in `/v1`, starting with `https://` (for example `https://api.openai.com/v1`). FixFlow adds `/chat/completions`.
- **Model**: the model's name, as the service calls it.
- **Key**: the key the service gave you.

FixFlow follows the OpenAI chat API, so other services that copy it should work too (OpenRouter, Groq and others, with their own address). Only OpenAI's own API is described by that name here: FixFlow has not been tried against each of the others.

An address on a private network is refused here with a pointer to **Local model**: a model on your own network is that choice, and it is the one that promises the data stays there.

## A local model

The point of this choice is that **no data leaves your network**. FixFlow therefore accepts only an address that is on **this server or a private network** (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10` and the private IPv6 ranges). A name that points at the internet is refused, and so is one that points at both. FixFlow checks the address when you save it and again before every call, since a name can start pointing somewhere else.

FixFlow can check where the address is, not what the machine at that address does with what it receives. A local model is only "local" if the program on that machine is.

Example with [Ollama](https://ollama.com):

1. On the machine that will run the model: `ollama pull llama3.1`.
2. In FixFlow, choose **Local model**, set the **Address** to `http://localhost:11434/v1` (when Ollama runs on the same server FixFlow runs on, outside Docker) and **Model** to `llama3.1`. Leave **Key** empty.
3. Press **Try it**.

**FixFlow in Docker, model on the same machine.** Inside the container `localhost` is the container itself, so use `http://host.docker.internal:11434/v1`. The supplied `docker-compose.prod.yml` and `docker-compose.lite.yml` make that name work on Linux too. Ollama listens only on the machine's own loopback by default, which a container cannot reach: set `OLLAMA_HOST=0.0.0.0` for Ollama, and then make sure the machine's firewall lets only the machines you want reach port 11434, because Ollama itself has no login. That has not been tried on a Linux server for this guide.

**Model on another machine** of your network: use its address, for example `http://192.168.1.40:11434/v1`.

A model on a small machine can take a while to answer, the first time especially, while it loads. FixFlow waits up to two minutes for a local model, and 30 seconds for the others. Small local models also give weaker answers than the large ones, and one with a short memory may fail when a work order brings long manuals; if so, try a model with a larger context.

## Keys

- A key is **kept encrypted** in the database and **never shown again**: the page only says that one is saved. Leave the box blank to keep it.
- Each provider keeps its **own** settings. Choosing another provider never sends the first one's key to it, and choosing the first one back finds its settings as they were.
- A key belongs to the host it was given for. If you change an address to **another host**, the saved key is dropped and you must enter it again, so a key cannot go to a different company by an edit to the address.
- Changing the app's `SECRET_KEY_BASE` makes the saved keys unreadable: enter them again.
- **Forget these settings** deletes everything saved, every provider's key included.

## The older way: the server's environment

Before the provider could be chosen on this page, AI was switched on in the server's `.env` file with `AI_ENABLED=true`, `ANTHROPIC_API_KEY` and, optionally, `AI_MODEL`. That still works, **for Claude only**, and only while nothing has been saved on **Settings → AI**. The page says when it is what is running. Anything saved on the page wins over it, **Off** included: an administrator can switch AI off even when the `.env` file would switch it on. **Forget these settings** goes back to the `.env` file.

## Limits and costs

The assistant, **Suggest a priority** and the **Try it** button count together against a limit of 5 requests a minute for each signed-in person, since each is a call to the model. Asking whether AI is on, and reading and saving the settings, do not count. Unusual-readings checks make no call to the model and have no limit, but each costs a little database work: a sensor's baseline is worked out once and remembered for ten minutes. Claude and the OpenAI-compatible services charge for what they process; a local model costs only the machine it runs on.

## When something goes wrong

**Try it** and the assistant say what happened in words. The common ones:

| Message | What to do |
|---|---|
| "… did not accept the key" | The key is wrong, expired or for another service. Enter it again |
| "Nothing is answering at …" | The program is not running, or the address or port is wrong. From inside Docker, `localhost` is the container: see above |
| "… could not be reached" | The name does not resolve, or the machine cannot be reached from the server |
| "… did not answer in time" | The service or the model is slow or overloaded. For a local model, try again once it has loaded |
| "… refused the request (404): model … not found" | The model's name is wrong, or it has not been pulled or loaded |
| "The address is not on this server or a private network…" | Local model needs an address on your own network. For a service on the internet use the OpenAI-compatible choice |
| "The address is on a private network…" | The OpenAI-compatible choice is for services on the internet. Use **Local model** |
| "… did not answer the way an OpenAI-compatible service does" | The address is not that kind of service. It usually needs to end in `/v1` |
