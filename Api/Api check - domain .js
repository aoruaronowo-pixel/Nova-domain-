
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Only GET requests are supported."
    });
  }

  const domain = String(req.query.domain || "")
    .trim()
    .toLowerCase();

  // Validate an ordinary domain name.
  const validDomain =
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

  if (!validDomain.test(domain)) {
    return res.status(400).json({
      error: "Enter a valid domain, such as example.com."
    });
  }

  const token = process.env.GODADDY_PAT;

  if (!token) {
    return res.status(500).json({
      error: "Domain API is not configured yet."
    });
  }

  try {
    const url = new URL(
      "https://api.godaddy.com/v3/domains/check-availability"
    );

    url.searchParams.set("domain", domain);
    url.searchParams.set("optimizeFor", "ACCURACY");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Domain provider returned status:",
        response.status
      );

      return res.status(502).json({
        error: response.status === 401 ||
          response.status === 403
          ? "The domain provider rejected the API credentials. Check the token and permissions."
          : "The domain provider could not complete the check. Try again later."
      });
    }

    if (typeof data.available !== "boolean") {
      return res.status(502).json({
        error: "The provider did not return a usable availability result."
      });
    }

    const prices = Array.isArray(data.prices)
      ? data.prices
      : [];

    const firstYear =
      prices.find(function (item) {
        return item.term === "YEAR" && item.period === 1;
      }) || prices[0];

    const price = firstYear && firstYear.price;
    const renewal = firstYear && firstYear.renewalPrice;

    return res.status(200).json({
      domain: data.domain || domain,
      available: data.available,
      definitive: data.definitive === true,
      currency: price ? price.currencyCode : null,
      registrationPrice:
        price && Number.isFinite(price.value)
          ? price.value / 100
          : null,
      renewalPrice:
        renewal && Number.isFinite(renewal.value)
          ? renewal.value / 100
          : null
    });
  } catch (error) {
    console.error("Domain availability check failed.");

    return res.status(502).json({
      error: "Could not contact the domain provider. Try again later."
    });
  }
};
                                
