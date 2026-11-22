Every time you share a link, you're running a small experiment: *will people care enough to tap it?* Click tracking is how you find out. But a raw click count is one of the easiest numbers in marketing to misread. This guide explains what's actually being counted, where the noise comes from, and how to read the results with confidence.

## What happens when someone clicks a short link

A short link is a pointer. When someone opens it, their browser asks the shortener's server where to go. The server looks up the destination, records the visit, and replies with a redirect. The browser then loads the real page.

That moment in the middle — between the request and the redirect — is where tracking happens. The shortener can see:

- **When** the request arrived.
- **Where it came from**, if the browser sends a *referrer* (for example, a social network or a newsletter's web version).
- **What made the request**: the browser and operating system, and whether it looks like a phone, tablet or desktop.
- **Roughly where** the visitor is, from their network address.

Nothing here needs a cookie or a tracking script on your website, which is why link analytics work even when you don't control the destination.

## Clicks are not people

The most common mistake is treating every click as a person. In reality, one visitor can click the same link five times, and some "clicks" aren't people at all.

### Unique visitors

To estimate how many *different* people clicked, a good tool groups clicks that look like they came from the same visitor. Zelqit does this with a salted, one-way hash of the network address and browser, so it can recognise a repeat visit without storing the address itself.

No method is perfect. Two people on the same office Wi-Fi with the same browser may look like one visitor; one person who switches from Wi-Fi to mobile data may look like two. Treat unique visitors as a solid estimate, and pay most attention to how it changes over time.

### Bots and link previews

When you paste a link into a chat app or social post, the platform often fetches it immediately to build a preview card. Search engines and security scanners visit links too. These automated visits can make a quiet link look popular.

Bot traffic is usually recognisable from its browser signature. A trustworthy click report keeps it **separate** rather than deleting it — you may want to know that a preview bot fetched your link, but you shouldn't count it as interest. In Zelqit, bot clicks are shown on their own and are left out of your totals unless you switch them on.

## Reading your referrers

The referrer tells you which website a visitor came from. It's genuinely useful, with one important caveat: **"direct" doesn't always mean typed in.**

Many apps — email clients, messaging apps, and some social apps — open links without sending a referrer. Those visits show up as *direct*. So if you share a link in a newsletter and see a big spike of direct traffic, that's probably your newsletter.

Two ways to get clearer source data:

1. **Use a separate short link per channel.** One link for Instagram, one for email, one for the poster. Then each link's clicks tell you the channel, regardless of referrers.
2. **Add UTM tags to the destination** so your website's own analytics can attribute the visit too. (See our guide to UTM parameters.)

## Devices and locations

Device type and operating system help you decide where effort pays off. If most clicks on a campaign come from phones, the landing page had better be fast and easy on a small screen.

Location is approximate — it comes from a lookup of the visitor's network address, which normally gets the country right and the city often right. It's best used for big-picture questions: *are people in the region we targeted actually clicking?*

## A simple routine for reading results

Numbers are only useful if you look at them the same way each time. A routine that works:

1. **Wait a day or two** before judging a link. Clicks often arrive in waves as people catch up on messages.
2. **Look at unique visitors first**, total clicks second. A big gap between them means repeat visits — interesting, but not new reach.
3. **Check the bot count.** If it's large, a platform is probably previewing your link; that's not a problem, just context.
4. **Compare like with like.** Compare a link with your own earlier links in the same channel, not with someone else's numbers.
5. **Write down what you changed.** A different headline, a new time of day, a new audience. Over a few campaigns, patterns appear.

## When something looks wrong

- **Sudden spike within seconds of posting:** likely previews and scanners. Check the bot count.
- **Plenty of clicks, few sales or sign-ups:** the link is doing its job; the problem is probably the landing page or the offer.
- **Almost no clicks:** check that the link works on a phone, that it hasn't expired, and that the message makes the reason to click clear.

## The takeaway

Click tracking is simple in principle and easy to misread in practice. Separate people from bots, prefer unique visitors over raw clicks, give each channel its own link, and compare results over time. Do that and your link analytics stop being a vanity number and start answering real questions.
