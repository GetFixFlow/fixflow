# Meters and usage-based maintenance

Count running hours, kilometres or cycles on an asset, and have maintenance fall due when the count reaches a number ("every 250 hours") instead of on a date.

## What a meter is

A **meter** belongs to one asset and has a name, a unit (hours, km, cycles, whatever you count in) and a **reading**: where the machine stands now. A machine can have several (an engine's hours and a truck's kilometres). Open the asset, choose the **Meters** tab.

| Who | Can |
| --- | --- |
| Administrators and managers | Add, rename and delete meters; record a reading; say a meter was replaced or reset |
| Technicians | See the meters; record a reading |
| Requesters | Nothing (they do not see assets) |

**Add a meter** (managers): give it a name and a unit and say **where the machine stands today** (a pump with 4,120 hours on it starts at 4,120; leave it at 0 for a new one). That first reading is kept in the meter's history.

## Recording a reading

**Record reading** on the meter, type the number, add a note if you like. The reading is always taken *now*; it cannot be dated in the past.

- **A meter only counts up.** A lower number than the last reading is refused, with the last reading in the message: it is almost always a typing slip, and a wrong low reading would hold back the maintenance that follows it.
- **A replaced or reset meter.** When the counter really was replaced (or rolled over), a manager ticks *The meter was replaced or reset* and enters the new reading. The history keeps it marked as a reset, and every schedule that follows the meter starts counting again, a full interval from the new reading.
- **History.** **History** on the meter lists the readings, newest first: when, the number, who took it (or *Sensor*) and the note.

## Maintenance that follows a meter

When you make a schedule (**Preventive Maintenance, New**), choose **Meter-Based** on the *Schedule* step, pick the asset's meter and the interval ("every 250 hours"). The page says the reading it will fall due at.

- It counts from the meter's reading **now**, unless you fill in **Last serviced at**: the reading when it was last done. If that was more than one interval ago, the first work order is made as soon as you save.
- **When the meter reaches the due reading, a work order is made** (from the schedule's template, like any other), and the schedule shows *At 4,370.5 hours (now 4,120.5, 250 to go)* instead of a date. A reading entered by hand or arriving from a sensor makes it happen at once; the hourly scheduler check catches anything missed.
- **One at a time.** While the work order is open no second one is made. When it falls due again, the next due reading is the next in the series (4,370.5, 4,620.5, ...) that is above the meter's reading, so a missed interval does not bring a second work order at once.
- **Trigger Now** on a schedule made before it is due counts the next one from the reading at that moment.
- Changing the interval moves the reading it falls due at; it keeps counting from the last service. A schedule must follow a meter of **its own asset**, and a meter cannot be deleted while a schedule follows it.

!!! note "Schedules made before meters existed"
    Older FixFlow versions let you choose "meter-based" but never acted on it. Those schedules have no meter and do nothing; open them (**Edit**) and choose a meter.

## A meter fed by a sensor

If a sensor already reports a running total, such as `running_hours`, a meter can follow it: in **Add meter**, type that metric's name under *Fed by a sensor*. Each time a reading of that metric arrives for this asset (see [Sensors and IoT](iot.md)) the meter moves up to it.

- The value must be a **running total that counts up**. A sensor that sends *on/off* or a rate (litres a minute) is not a meter; FixFlow does not add those up.
- A reading that is not higher than the meter, or older than the last one, is ignored, and a sensor in trouble never stops its data from being stored.
- A sensor's history in the meter is kept at most once an hour (it can report every few seconds); the meter itself is always current.
- You can still record a reading by hand on a sensor-fed meter, for example to correct it.

## What it does not do

- It does not turn *machine on* signals into hours, or convert between units; the meter counts in the unit you named.
- Readings cannot be backdated or edited afterwards.
- There is no report of meter history yet beyond each meter's own list.

The meters are in the [API](api-endpoints.md) under `assets/:id/meters`, `meters/:id` and `meters/:id/readings`.
