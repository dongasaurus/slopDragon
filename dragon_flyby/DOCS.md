# Dragon Flyby

Every few minutes a dragon swoops across your dashboard, then disappears. Holiday themes swap the dragons for Santa's sleigh, witches, skeletons, the Easter bunny and more. By default it stays on screen for 5 seconds (you can allow up to 10), and it doesn't change anything on the dashboard.

## Setup

1. Click **Start**.
2. Refresh your dashboard (on a wall tablet, reload the page).

The add-on installs the dragon, then stops. **Seeing "stopped" afterwards is normal.** The dragon runs in your browser, so nothing has to stay running.

If the log says the `www` folder was just created, restart Home Assistant once, then refresh your dashboard.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `enabled` | `true` | Turn this off and start the add-on again to remove the visitors. |
| `interval_minutes` | `15` | Minutes between visits (1 to 1440). |
| `duration_seconds` | `5` | Seconds each visit lasts (1 to 10). |
| `theme` | `dragons` | Any theme below, or `auto`. |
| `unicorn_chance` | `5` | Percent chance (0 to 25) that a unicorn flies by instead of the usual visitor, in every theme. `0` turns it off. |
| `dragon` | `random` | Optional, hidden under **Show unused optional configuration options**. Picks one dragon for the `dragons` theme (and `auto` outside the holidays): `random`, `shadow` (Shadow Wing), `spike` (Spike Tail), `ember` (Ember Horn) or `moon` (Moon Glider). |
| `size` | `medium` | `small`, `medium`, `large` or `extralarge`. |
| `dashboards_only` | `true` | Only show visitors on dashboards, not on Settings or other pages. |
| `fly_on_load` | `false` | Also send a visitor a few seconds after a dashboard opens. |
| `weather_entity` | `auto` | The weather entity for the `weather` theme, for example `weather.melbourne` from the Bureau of Meteorology integration. `auto` uses `weather.forecast_home` or the first weather entity found. |
| `auto_holidays` | all | Which holidays `auto` celebrates. |
| `birthdays` | none | People to celebrate, see below. |

After changing options, start the add-on again and refresh your dashboards.

## Themes

| Theme | Who shows up |
| --- | --- |
| `dragons` | Four original dragons inspired by *How to Train Your Dragon*. |
| `christmas` | Santa's sleigh and reindeer, a flying reindeer, a dragon in a Santa hat, an elf walking along the bottom with a present. |
| `australianchristmas` | Santa's sleigh pulled by kangaroos, Santa surfing, Santa playing cricket, Santa cooling off in front of the air conditioner, a reindeer with a fan, Santa on a flamingo pool floatie, a dragon in a Santa hat. |
| `halloween` | A witch on a broomstick, a swarm of bats, a ghost, a skeleton walking and a jack-o'-lantern hopping along the bottom. |
| `easter` | The Easter bunny hopping with a basket of eggs, a chick waddling, butterflies. |
| `minecraft` | Blocky pixel art walking along the bottom: Steve with a pickaxe, a creeper that flashes and hisses, an enderman carrying a block, a skeleton archer, Denis the dog. |
| `weather` | Matches the weather: sun in sunnies, clouds, a duck with an umbrella in the rain, storm clouds, a kite when windy, a snowman and penguin in snow, an owl at night, a melting ice cream at 35°C or more. |
| `newyear` | Fireworks, a "Happy New Year" banner plane, the dragon in a party hat. |
| `lunarnewyear` | A lion dance, a parade dragon, red lanterns. |
| `valentines` | Cupid, floating hearts, lovebirds. |
| `stpatricks` | A leprechaun with a pot of gold, shamrocks, a rainbow. |
| `diadelosmuertos` | A dancing calavera, monarch butterflies, marigolds. |
| `diwali` | Diyas, a rangoli, fireworks. |
| `eid` | A crescent moon ("Eid Mubarak!"), fanous lanterns. |
| `birthdays` | Balloons, a birthday cake, the banner plane and party dragon, greeting people by name. |
| `auto` | Each holiday on its dates: New Year, Valentine's, St Patrick's, Lunar New Year, Diwali, Eid, Día de los Muertos, Easter, Halloween and Christmas (the Australian one if Home Assistant's country or time zone is Australia). Birthdays on the day, dragons otherwise. The README lists every date. |

## Unicorns and the Dragon setting

- Any visit, in any theme, has a `unicorn_chance` percent chance of being a unicorn with a rainbow trail. `0` turns it off.
- Home Assistant can't hide a setting depending on another one, so **Dragon** is an optional setting instead. Turn on **Show unused optional configuration options** to see it. It only matters for the `dragons` theme, and for `auto` outside the holidays.

## Weather

The weather theme reads your weather entity live from Home Assistant, so it needs no internet access or extra setup. Any weather integration works, including the Bureau of Meteorology one (`weather.<your town>`). A forecast text sensor also works. Home Assistant's sun is used to tell day from night. To check what it sees, run `dragonFlyby.weather()` in the browser console on a dashboard.

## Birthdays

Use **⋮ → Edit in YAML** on the Configuration tab:

```yaml
birthdays:
  - name: Mia
    day: 12
    month: 3
    year: 2019
```

The year is optional and adds the age ("Happy 7th birthday, Mia!"). On the day, `auto` switches to birthdays, and other themes mix birthday visitors in.

## Good to know

- The add-on adds one dashboard resource, `/local/dragon-flyby/dragon-flyby.js`. You'll see it under **Settings → Dashboards → ⋮ → Resources**.
- No dragon shows when the browser tab is hidden or when the device is set to reduce motion.
- To summon one right away, open the browser console on a dashboard and run `dragonFlyby.fly()`, `dragonFlyby.fly("christmas")` or `dragonFlyby.fly("witch")`.

## Troubleshooting

**No dragon after 15 minutes**
Check the add-on log. Make sure you refreshed the dashboard after starting the add-on. Set `fly_on_load` to `true` to check quickly.

**The log says it couldn't register the resource**
Your dashboard resources are managed in YAML. Add the URL from the log to your `resources:` list as `type: module` and restart Home Assistant.

**Removing it**
Set `enabled` to `false` and start the add-on once. Then you can uninstall it.
