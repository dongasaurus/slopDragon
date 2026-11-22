# Changelog

## 1.7.0

- New `weather` theme: visitors match the weather outside, read from your own weather entity (`weather_entity`), for example the Bureau of Meteorology integration. Sun in sunnies, clouds, a duck with an umbrella, storm clouds, a kite, a snowman, a penguin, a night owl, and a melting ice cream when it's 35°C or hotter.
- New holiday themes: `newyear`, `lunarnewyear`, `valentines`, `stpatricks`, `diadelosmuertos`, `diwali`, `eid` and `birthdays`.
- `birthdays` option: add people with a name, day, month and optional birth year. On the day, birthday visitors say "Happy birthday" by name, in `auto` and mixed into every other theme.
- `auto` now follows all of these holidays. Moving dates (Lunar New Year, Diwali, Eid, Easter) are calculated, so they stay right every year. New `auto_holidays` option to choose which ones it uses.

## 1.6.0

- A unicorn with a rainbow trail can now turn up in every theme. New `unicorn_chance` option: 5% by default, 0 (off) to 25%.
- New `extralarge` size.
- The Dragon setting is now optional and hidden under "Show unused optional configuration options", since it only matters for the dragons and auto themes.
- Setting descriptions no longer talk about dragons when they apply to every visitor.

## 1.5.0

- New `minecraft` theme in blocky pixel art, all walking along the bottom of the screen: Steve with a diamond pickaxe, a creeper that flashes and hisses (it never explodes), an enderman carrying a grass block that blinks away mid-walk, a skeleton archer that fires an arrow, and Denis the dog.

## 1.4.0

- Australian Christmas: Santa relaxes in a deckchair in front of an air conditioner, with icy wind and snowflakes ("Ahhh, bliss!").
- Both Christmas themes: a dragon flies by wearing a Santa hat.

## 1.3.0

- New `australianchristmas` theme: Santa's sleigh pulled by kangaroos, Santa surfing, Santa running between the wickets, a reindeer keeping cool with a fan, and Santa drifting by on a flamingo pool floatie.
- `auto` uses the Australian Christmas in December when Home Assistant's country (or time zone) is Australia.

## 1.2.0

- New `theme` option with holiday modes:
  - `christmas`: Santa's sleigh and reindeer fly by, an elf walks along the bottom with a present.
  - `halloween`: witches and bats fly by, a ghost floats past, skeletons walk and a jack-o'-lantern hops along the bottom.
  - `easter`: the Easter bunny hops along the bottom, a chick waddles past, butterflies flutter by.
  - `auto`: follows the calendar (Halloween in October, Christmas in December, Easter week), dragons the rest of the year.

## 1.1.0

- `duration_seconds` now goes up to 10 seconds. The default is still 5.

## 1.0.0

- First release: four original dragons fly across your dashboards every 15 minutes, for up to 5 seconds.
