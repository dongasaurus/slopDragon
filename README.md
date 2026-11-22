# Dragon Flyby for Home Assistant

Every 15 minutes a dragon swoops across your Home Assistant dashboard. Or, with a theme, Santa's sleigh, a surfing Santa, fireworks, a lion dance, a duck with an umbrella when it rains, or balloons on your birthday. It stays on screen for 5 seconds (configurable up to 10), flies over everything, and doesn't change anything on the dashboard underneath it.

![The four dragons](docs/dragons.png)

The dragons are original artwork inspired by the films *How to Train Your Dragon*: big wings, big eyes, a cheeky blast of fire or plasma halfway across.

| Dragon | Style | Breath |
| --- | --- | --- |
| Shadow Wing (`shadow`) | Sleek, jet black, green eyes | Purple plasma |
| Spike Tail (`spike`) | Blue, horned crown, spiked tail | White-hot blast |
| Ember Horn (`ember`) | Red, curved horns, spiny back | Flame |
| Moon Glider (`moon`) | Pale and glowing, ice-blue eyes | Blue-white plasma |

## Themes

Set the `theme` option to swap the dragons for seasonal, weather or Minecraft visitors. They follow the same interval and duration.

![Holiday visitors](docs/holidays.png)

![Celebrations](docs/celebrations.png)

| Theme | Who shows up |
| --- | --- |
| `christmas` | Santa's sleigh and reindeer fly by ("Ho ho ho!"), a lone reindeer gallops across the sky, a dragon flies by in a Santa hat, an elf walks along the bottom carrying a present. |
| `australianchristmas` | Christmas in an Aussie summer: Santa's sleigh pulled by hopping kangaroos ("G'day!"), Santa surfing a wave along the bottom, Santa in cricket pads and zinc cream running between the wickets ("Yes! Run!"), Santa cooling off in a deckchair in front of the air conditioner ("Ahhh, bliss!"), a reindeer in sunnies cooling off with a fan, Santa drifting past on a flamingo pool floatie with a cold drink, and the dragon in a Santa hat. |
| `halloween` | A witch on her broomstick (with her cat) and a swarm of bats fly by, a ghost floats past ("BOO!"), a skeleton walks and a jack-o'-lantern hops along the bottom. |
| `easter` | The Easter bunny hops along the bottom with a basket of eggs, a chick in its eggshell waddles past, butterflies flutter by. |
| `minecraft` | Blocky pixel-art visitors walking along the bottom: Steve with a diamond pickaxe, a creeper that flashes and hisses ("Sssss...", it never explodes), an enderman carrying a grass block that teleports mid-walk, a skeleton archer that fires an arrow, and Denis the dog ("Woof!"). Not part of `auto`. |
| `weather` | Visitors that match the weather outside, read from your weather entity. See [Weather theme](#weather-theme). |
| `newyear` | Fireworks, a plane towing a "Happy New Year 2027!" banner, and the dragon in a party hat. |
| `lunarnewyear` | A lion dance along the bottom ("Happy Lunar New Year!"), a long parade dragon, floating red lanterns. |
| `valentines` | Cupid firing a heart-tipped arrow, floating hearts, two lovebirds carrying a heart. |
| `stpatricks` | A leprechaun with a pot of gold ("Happy St Paddy's!"), spinning shamrocks, a rainbow ending in gold. |
| `diadelosmuertos` | A dancing calavera with a flower crown and maracas ("¡Feliz Día de Muertos!"), monarch butterflies, marigolds. |
| `diwali` | Floating diyas (oil lamps), a blooming rangoli, fireworks. |
| `eid` | A glowing crescent moon ("Eid Mubarak!") and swinging fanous lanterns. |
| `birthdays` | Balloons and a walking birthday cake saying "Happy birthday" by name, the banner plane and the party dragon. See [Birthdays](#birthdays). |
| `auto` | Follows the calendar, with dragons the rest of the year. See [The auto calendar](#the-auto-calendar). |

## Weather theme

![Weather visitors](docs/weather.png)

With `theme: weather`, each visitor matches the weather right now:

| Weather | Visitors |
| --- | --- |
| Sunny | Sun in sunnies (a night owl after dark) |
| Partly cloudy | Sun or a happy cloud |
| Cloudy, fog | Happy cloud |
| Rain | Duck with an umbrella, rain cloud |
| Storms | Grumpy storm cloud, duck with an umbrella |
| Snow, hail, frost | Snowman, penguin ("Brrr!") |
| Windy | Kite |
| Clear night | Night owl |
| 35°C or hotter | A melting ice cream joins in ("Phew, 38°!") |
| 3°C or colder | A penguin joins in |

**Where the weather comes from:** the script reads a weather entity from your Home Assistant, the same live data your dashboard cards use. It needs no internet access or extra setup.

- Leave `weather_entity` as `auto` to use `weather.forecast_home`, or failing that the first weather entity it finds.
- Or set it to your own, for example `weather.melbourne` from the [Bureau of Meteorology](https://github.com/bremor/bureau_of_meteorology) integration. Find the name under **Settings → Devices & services → Entities**.
- A text sensor works too, such as the Bureau's `sensor.melbourne_short_text_0`. Words like "shower", "sunny" or "storm" are understood.
- Home Assistant's sun tells it when it's night. The Bureau's entity reports the day's forecast around the clock, so this keeps the sun from appearing at midnight.
- If the entity can't be read, dragons fly instead. Run `dragonFlyby.weather()` in the browser console on a dashboard to see what it reads.

## Birthdays

Add birthdays in the add-on's **Configuration** tab (use **⋮ → Edit in YAML** if the form doesn't show a list editor):

```yaml
birthdays:
  - name: Mia
    day: 12
    month: 3
    year: 2019
  - name: Sam
    day: 4
    month: 11
```

On the day, balloons, a birthday cake, the banner plane and the party dragon say "Happy 7th birthday, Mia!" (the year is optional, for the age).

- In `auto`, birthdays take over for the whole day.
- In any other theme, about half the visits that day are birthday visitors.
- To turn this off, remove `birthdays` from `auto_holidays`.
- Names and dates are stored in the dashboard resource address, which anyone with access to your Home Assistant can see.

## The auto calendar

`auto` picks the first holiday that matches today, in this order:

| Holiday | When |
| --- | --- |
| `birthdays` | On each birthday you add |
| `newyear` | 31 December and 1 January |
| `valentines` | 12 to 14 February |
| `stpatricks` | 15 to 17 March |
| `lunarnewyear` | Lunar New Year's Eve and the week after |
| `diwali` | Two days either side of Diwali |
| `eid` | Eid al-Fitr (first 3 days) and Eid al-Adha (9 to 13 Dhu al-Hijjah) |
| `diadelosmuertos` | 1 and 2 November |
| `easter` | A week before Easter Sunday to Easter Monday |
| `halloween` | All of October |
| `christmas` | All of December (the Australian one if Home Assistant is set to Australia) |

The dates that move each year are calculated, so they stay right with no updates:
- **Easter:** the standard church calculation.
- **Lunar New Year and Diwali:** calculated from the moon.
- **Eid:** your browser's Islamic (Umm al-Qura) calendar. Local moon sightings can shift Eid by a day.

Untick holidays in `auto_holidays` to leave them out. `weather` and `minecraft` aren't part of `auto`.

## The unicorn

![The unicorn](docs/unicorn.png)

Whatever the theme, every visit has a small chance (5% by default) of being a unicorn instead, galloping across the sky with a rainbow trail. Set `unicorn_chance` between `0` (never) and `25`.

## Install

[![Add this repository to your Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fdongasaurus%2FslopDragon)

1. In Home Assistant go to **Settings → Add-ons → Add-on Store**.
2. Open the **⋮** menu → **Repositories**, add `https://github.com/dongasaurus/slopDragon` and close the dialog.
3. Find **Dragon Flyby**, click **Install**, then **Start**.
4. Refresh your dashboard (on a wall tablet, reload the page).

The add-on installs the dragon, then stops. **Seeing "stopped" afterwards is normal.** The dragon runs in your browser, so nothing has to stay running. It starts again by itself each time Home Assistant boots.

> If the log says the `www` folder was just created, restart Home Assistant once so it starts serving the dragon file.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `enabled` | `true` | Turn this off and start the add-on again to remove the visitors. |
| `interval_minutes` | `15` | Minutes between visits (1 to 1440). |
| `duration_seconds` | `5` | Seconds each visit lasts (1 to 10). |
| `theme` | `dragons` | Any theme above, or `auto` (follows the calendar). |
| `unicorn_chance` | `5` | Percent chance (0 to 25) that a unicorn flies by instead of the usual visitor, in every theme. `0` turns it off. |
| `dragon` | `random` | Optional, hidden under **Show unused optional configuration options**. Picks one dragon for the `dragons` theme (and `auto` outside the holidays): `random`, `shadow`, `spike`, `ember` or `moon`. |
| `size` | `medium` | `small`, `medium`, `large` or `extralarge`. |
| `dashboards_only` | `true` | Only show visitors on dashboards, not on Settings or other pages. |
| `fly_on_load` | `false` | Also send a visitor a few seconds after a dashboard opens. Handy for testing. |
| `weather_entity` | `auto` | The weather entity for the `weather` theme, for example `weather.melbourne`. |
| `auto_holidays` | all | Which holidays `auto` celebrates. |
| `birthdays` | none | People to celebrate: `name`, `day`, `month` and optional `year`. |

After changing options, start the add-on again and refresh your dashboards.

## How it works

- The add-on copies `dragon-flyby.js` to `/config/www/dragon-flyby/` and adds it as a dashboard resource (**Settings → Dashboards → ⋮ → Resources**). The options go in the resource URL.
- In the browser, the script waits for the interval, then adds one overlay element on top of the page. The overlay ignores taps and clicks, so everything underneath keeps working, and it's isolated in a shadow root, so it can't restyle anything. It's removed as soon as the flight ends.
- It skips a flight when the tab is hidden, when you're not on a dashboard (if `dashboards_only` is on), or when the device asks for reduced motion.
- Each browser has its own timer, so every open dashboard gets its own dragon.

Want one right now? Open your browser's developer console on a dashboard and run:

- `dragonFlyby.fly()` for a visitor from the current theme
- `dragonFlyby.fly("halloween")` for a random visitor from a theme
- `dragonFlyby.fly("sleigh")` for a specific one (`dragonFlyby.characters` lists them all)

## Without the add-on store

On Home Assistant Container or Core (no add-ons), install it by hand:

1. Copy [`dragon_flyby/www/dragon-flyby.js`](dragon_flyby/www/dragon-flyby.js) to `/config/www/dragon-flyby/dragon-flyby.js`.
2. Go to **Settings → Dashboards → ⋮ → Resources → Add resource**.
3. URL: `/local/dragon-flyby/dragon-flyby.js?interval=15&duration=5`, type **JavaScript module**.

Use the same options in the URL: `interval`, `duration`, `theme`, `dragon`, `unicorn`, `size`, `weather` (an entity id), `holidays` (comma-separated), `birthdays` (JSON), `dashboards` (`1`/`0`) and `onload` (`1`/`0`).

If your resources are managed in YAML:

```yaml
lovelace:
  resources:
    - url: /local/dragon-flyby/dragon-flyby.js?interval=15&duration=5
      type: module
```

## Development

Preview the dragons without Home Assistant:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/demo/ and use the buttons to summon any theme or character.

Run the tests:

```bash
pip install websockets && python3 -m unittest discover tests
```

```bash
node --test tests/frontend.test.cjs
```

The browser tests need Node 18+ and Playwright with Chromium.

## Credits

Original artwork and code. The dragons are inspired by DreamWorks Animation's *How to Train Your Dragon*. This project isn't affiliated with or endorsed by DreamWorks.

The `minecraft` theme is fan art. Minecraft is a trademark of Mojang Synergies AB, and this project isn't affiliated with or endorsed by Mojang or Microsoft.
