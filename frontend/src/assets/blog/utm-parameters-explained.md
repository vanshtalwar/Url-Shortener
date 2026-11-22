If you've ever looked at a website's analytics and wondered which of your posts, emails or ads actually sent the traffic, UTM parameters are the answer. They're small labels added to the end of a URL that tell analytics tools where a visit came from. They're simple, free, and remarkably easy to get wrong.

## What a UTM-tagged link looks like

Here's an ordinary link:

```
https://example.com/spring-sale
```

And the same link with UTM parameters:

```
https://example.com/spring-sale?utm_source=newsletter&utm_medium=email&utm_campaign=spring_sale_2026
```

Everything after the `?` is a set of `name=value` pairs. The page itself doesn't change; the labels are read by your website's analytics (such as Google Analytics) when the visitor lands.

## The five parameters

There are five standard UTM parameters. Three are the backbone of almost every report.

### utm_source — *who* sent the visit

The specific place the click came from: `newsletter`, `instagram`, `partner_blog`, `qr_poster`. Be specific enough that you could act on the result.

### utm_medium — *what kind* of channel

The broad category: `email`, `social`, `cpc` (paid ads), `referral`, `print`. Analytics tools group results by medium, so keep this list short and fixed.

### utm_campaign — *why* the link exists

The initiative or promotion: `spring_sale_2026`, `product_launch`, `webinar_march`. This is what lets you add up everything one campaign achieved across all channels.

### utm_term and utm_content — optional detail

- **utm_term** was designed for paid search keywords. You can also use it for an audience segment.
- **utm_content** distinguishes versions of the same link: `header_button` vs `footer_link`, or `video_a` vs `video_b`. It's ideal for simple A/B comparisons.

## Naming rules that save you later

UTM values are case-sensitive and stored exactly as written. `Email`, `email` and `e-mail` become three different rows in your report. A few rules prevent that:

1. **Use lowercase everywhere.**
2. **Pick one separator** — underscores or hyphens — and never mix them. `spring_sale` and `spring-sale` won't be combined.
3. **No spaces.** They turn into `%20` and are easy to mistype.
4. **Keep a written list** of allowed sources and mediums, and reuse it. Saved presets in a link tool are even better, because nobody has to remember the spelling.
5. **Be descriptive, not clever.** `fb_ad_v2_final` means nothing in six months; `facebook` + `cpc` + `spring_sale_2026` + `carousel_a` still does.

## Mistakes that quietly break reports

### Tagging internal links

Never add UTM parameters to links *within your own website*. When a visitor clicks one, many analytics tools start a new session and credit it to your fake "source", wiping out where the visitor really came from. UTMs are for links that bring people **in** from elsewhere.

### Inconsistent mediums

If one teammate uses `social` and another uses `social-media`, your channel report splits in two. This is the most common reason UTM reports look messy.

### Forgetting the campaign

A link with a source and medium but no campaign tells you *where* traffic came from but not *what it was for*. Always set all three core parameters.

### Long, ugly links in public

UTM-tagged URLs are long and can look suspicious in a post or on a printed page. That's exactly where a short link helps: share the short link, and let it redirect to the full tagged URL.

## UTMs and short links work best together

A short link and UTM parameters answer slightly different questions:

- The **short link's own analytics** tell you how many people clicked, when, from which device, and roughly where — even if you don't control the destination website.
- The **UTM tags** tell your website's analytics what those visitors did *after* they arrived — which pages they read, whether they signed up or bought.

Together, you can follow a visitor from the post they saw all the way to the result you care about. In Zelqit Pro, the UTM builder adds the tags to the destination for you, and saved presets keep your naming consistent across everyone who creates links.

## Reading UTM data in your reports

Once tagged links are out in the world, most analytics tools show the results under an acquisition or traffic-source report, grouped by source, medium and campaign.

Start broad and drill down. Look at **medium** first to see which kind of channel performs best — email, social or print. Then open the best medium to compare **sources** within it. Finally filter by **campaign** to see the total effect of one promotion across every channel.

If a campaign looks smaller than you expected, compare its visits with the clicks on the short links you used. A big gap usually means visitors left before the page finished loading, or a link was shared without its tags.

## A quick checklist

Before you publish a tagged link:

- Source, medium and campaign are all set.
- Everything is lowercase with one consistent separator.
- The values match your team's written list.
- The link points to an external page (not an internal link on your own site).
- You're sharing the short version, not the long tagged URL.

Get these right once, reuse them every time, and your campaign reports will finally line up with what actually happened.
