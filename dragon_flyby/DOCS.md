# Dragon Flyby

Every few minutes a dragon swoops across your dashboard, then disappears. It never stays on screen for more than 5 seconds and it doesn't change anything on the dashboard.

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
| `duration_seconds` | `5` | Seconds each flight lasts (1 to 5). |
| `dragon` | `random` | `random`, `shadow` (Shadow Wing), `spike` (Spike Tail), `ember` (Ember Horn) or `moon` (Moon Glider). |
| `size` | `medium` | `small`, `medium` or `large`. |
| `dashboards_only` | `true` | Only fly over dashboards, not over Settings or other pages. |
| `fly_on_load` | `false` | Also send a dragon a few seconds after a dashboard opens. |

After changing options, start the add-on again and refresh your dashboards.

## Good to know

- The add-on adds one dashboard resource, `/local/dragon-flyby/dragon-flyby.js`. You'll see it under **Settings → Dashboards → ⋮ → Resources**.
- No dragon shows when the browser tab is hidden or when the device is set to reduce motion.
- To summon one right away, open the browser console on a dashboard and run `dragonFlyby.fly()`.

## Troubleshooting

**No dragon after 15 minutes**
Check the add-on log. Make sure you refreshed the dashboard after starting the add-on. Set `fly_on_load` to `true` to check quickly.

**The log says it couldn't register the resource**
Your dashboard resources are managed in YAML. Add the URL from the log to your `resources:` list as `type: module` and restart Home Assistant.

**Removing it**
Set `enabled` to `false` and start the add-on once. Then you can uninstall it.
