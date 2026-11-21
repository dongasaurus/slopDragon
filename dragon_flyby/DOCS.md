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
| `enabled` | `true` | Turn this off and start the add-on again to remove the dragon. |
| `interval_minutes` | `15` | Minutes between flights (1 to 1440). |
| `duration_seconds` | `5` | Seconds each flight lasts (1 to 10). |
| `theme` | `dragons` | `dragons`, `christmas`, `australianchristmas`, `halloween`, `easter` or `auto`. See below. |
| `dragon` | `random` | Used by the `dragons` theme: `random`, `shadow` (Shadow Wing), `spike` (Spike Tail), `ember` (Ember Horn) or `moon` (Moon Glider). |
| `size` | `medium` | `small`, `medium` or `large`. |
| `dashboards_only` | `true` | Only fly over dashboards, not over Settings or other pages. |
| `fly_on_load` | `false` | Also send a dragon a few seconds after a dashboard opens. |

After changing options, start the add-on again and refresh your dashboards.

## Themes

| Theme | Who shows up |
| --- | --- |
| `dragons` | Four original dragons inspired by *How to Train Your Dragon*. |
| `christmas` | Santa's sleigh and reindeer, a flying reindeer, an elf walking along the bottom with a present. |
| `australianchristmas` | Santa's sleigh pulled by kangaroos, Santa surfing, Santa playing cricket, a reindeer cooling off with a fan, Santa on a flamingo pool floatie. |
| `halloween` | A witch on a broomstick, a swarm of bats, a ghost, a skeleton walking and a jack-o'-lantern hopping along the bottom. |
| `easter` | The Easter bunny hopping with a basket of eggs, a chick waddling, butterflies. |
| `auto` | Halloween in October, Christmas in December (the Australian one if Home Assistant's country or time zone is Australia), Easter from a week before Easter Sunday to Easter Monday, dragons the rest of the year. |

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
