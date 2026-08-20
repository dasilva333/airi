# Finding Open APIs and Curated Directories for Model Context Protocol (MCP) Servers/"Plugins"

## Executive Summary

The Model Context Protocol (MCP) ecosystem does have a free, open registry API that exposes a machine‑readable list of MCP servers, which in practice function as “plugins” for tools like Claude, Cursor, or Copilot. However, this official API currently focuses on canonical listing and basic search rather than built‑in “trending/popular” metrics. Popularity and vetting signals are primarily provided by third‑party directories (MCP.so, PulseMCP, Glama, MCP Market, etc.), most of which surface metrics via their websites but do not clearly document fully open JSON APIs for those rankings. Developers who want both openness and popularity signals typically combine the official registry API with external metrics (for example, GitHub stars) or scrape/bridge directory UIs where terms of service allow.[^1][^2][^3][^4]

## Official MCP Registry API

The official MCP Registry is hosted at `registry.modelcontextprotocol.io` and is described as the authoritative repository for publicly available MCP servers, “like an app store for MCP servers.” The public API exposes core endpoints such as `GET /v0/servers` for paginated server lists, `GET /v0/servers/{id}` for individual server metadata, and `POST /v0/publish` for publishing new servers (with authentication), which together satisfy the requirement for a free, open API listing MCP servers.[^1]
The registry is community‑owned and backed by contributors including Anthropic, GitHub, PulseMCP, and Microsoft, with an extensible metadata model designed so that sub‑registries or tools can add extra properties like tags, categorization, and curation data.[^2][^1]

## Support for Trending/Popularity in the Official API

Available documentation for the official MCP Registry emphasizes canonical server discovery and metadata consistency rather than built‑in popularity rankings such as trending or “most installed.” The API’s primary query capabilities are listing and keyword search, and there is no explicit mention in public docs of first‑class fields for download counts, call volume, user ratings, or similar popularity metrics.[^3][^2][^1]
The registry design allows other systems to layer popularity or vetting information on top of the base catalog, for example by combining registry server entries with GitHub statistics, traffic data, or third‑party curation signals provided by other registries.[^2][^3]

## Third‑Party Directories with Popularity Metrics

Multiple community and commercial directories sit on top of the MCP ecosystem and provide ranking and popularity views over large catalogs of servers. A survey of MCP registries highlights options such as MCP.so, PulseMCP, MCP Market, Glama, and others, each with different focuses and metrics.[^4][^5][^3]
These sites typically present web UIs with filters like Featured, Trending, Latest, category tags, visitor counts, and estimated search traffic; however, public documentation rarely exposes these rankings as stable, versioned, unauthenticated JSON APIs in the same way as the official MCP Registry.[^3][^4]

## Examples of Popularity‑Focused MCP Directories

A Nordic APIs overview describes MCP.so as a “usage‑driven aggregator” that offers call‑based rankings and multiple filters (Featured, Latest, Official, Hosted) over an extensive MCP catalog, emphasizing real‑world adoption snapshots and trending activity. PulseMCP is characterized as a directory focused on discoverability and popularity signals, aggregating thousands of servers and exposing visitor metrics, popularity sorting, and classification filters in its UI.[^6][^4][^3]
MCP Market and similar sites provide use‑case categories and GitHub‑style star ratings, while Public MCP Registry and other public catalogs position themselves as comprehensive listings aimed at helping developers get discovered by thousands of visitors.[^7][^8][^4]

## Curated/Vetted Registries

Some directories explicitly emphasize vetting and curation beyond raw popularity. For example, Glama is described as offering a curated “seal of approval” for MCP servers by combining automated scans with manual reviews to check for adequate READMEs, valid licenses, and absence of known vulnerabilities, which yields a catalog optimized for quality over sheer quantity.[^4]
MCP.so is reported to maintain a large set of “verified” servers and to perform stability and accuracy checks, maintaining version history, changelogs, and a user‑submitted bug repository—again indicating a curated, quality‑screened subset rather than an unfiltered list.[^5]

## APIs and Programmatic Access Around Popularity Metrics

Beyond the official MCP Registry, there are a few programmatic options that expose popularity or trending information, though they may not fit the strict definition of a free, open REST API with no platform coupling. An Apify “MCP Registry Actor” advertises advanced search, category browsing, “Trending Servers,” and popularity metrics such as real‑time GitHub stars and install counts; these are made available via the Apify platform’s actor API rather than a standalone public registry endpoint.[^9]
Individual directories sometimes provide their own MCP servers that act as discovery tools: for example, the `mcp-registry` server is itself an MCP server that wraps the MCP Registry API to let clients discover other servers programmatically, again focusing on canonical listings while leaving popularity logic to the consuming application.[^10][^1]

## How Developers Typically Combine Openness and Popularity

Given this landscape, a common pattern for developers who want both openness and popularity is to treat the official registry as the source of truth for server metadata, then enrich that data with external metrics. For example, GitHub‑based server catalogs expose native trust and popularity signals via repository stars, forks, and activity, even though they do not natively rank servers by usage.[^11][^3]
Other teams aggregate multiple registries and layer their own analytics, as described in technical overviews of MCP registries that emphasize extensible metadata and cross‑registry aggregation; in these cases, popularity is computed from external traffic logs, call counts, or search data, then surfaced through bespoke dashboards or internal APIs rather than through a single global public endpoint.[^12][^13][^2]

## Practical Options for a Curated, Sortable MCP “Plugin” List

For a developer looking today for a curated list of MCP “plugins” that can be grouped or sorted by popularity and recency, the most realistic approach is to combine one of the large curated directories with either its UI filters or any available platform‑specific API. Sites like MCP.so and PulseMCP already provide filterable views by Featured, Latest, Popular, and category, while Glama and MCP Market layer in vetting, quality indicators, and user‑visible ratings.[^5][^3][^4]
At the same time, the only clearly documented fully open registry‑style API is the official MCP Registry (and compatible subregistries), which does not itself implement popularity metrics; building a “trending MCP plugin” API today generally means querying that registry, enriching with popularity signals from GitHub or directory UIs, and exposing a custom service tailored to specific popularity definitions and use cases.[^1][^2][^3]

---

## References

1. [MCP Registry](https://modelcontextprotocol.info/tools/registry/) - The MCP registry provides MCP clients with a list of MCP servers, like an app store for MCP servers....

2. [MCP Registry Architecture: A Technical Overview - WorkOS](https://workos.com/blog/mcp-registry-architecture-technical-overview) - The Model Context Protocol (MCP) Registry helps AI applications discover and connect to context prov...

3. [7 MCP Registries Worth Checking Out - Nordic APIs](https://nordicapis.com/7-mcp-registries-worth-checking-out/) - The Official MCP Registry · GitHub MCP Registry · MCP.SO · Mastra MCP Registry Registry · OpenTools ...

4. [Best MCP Server Directories for Developers - Descope](https://www.descope.com/blog/post/mcp-directories) - " Popularity metrics, such as estimated visitor numbers and rankings, make it a good choice for brow...

5. [Top 5 Directories to Discover MCP Servers for Smarter AI Workflows](http://www.allvoicelab.com/blog/top-5-directories-to-discover-mcp-servers-for-smarter-ai-workflows) - Discover the best MCP server directories to power up your AI workflows. Explore curated lists from S...

6. [MCP Server Directory: 11150+ updated daily](https://www.pulsemcp.com/servers) - A daily-updated directory of all Model Context Protocol (MCP) servers available on the internet. Con...

7. [Public MCP Registry - Discover Best MCP Servers & AI Tools ...](https://publicmcpregistry.com) - List your server on the registry and get discovered by thousands of developers. Submit Your Listing ...

8. [Discover Top MCP Servers | MCP Market](https://mcpmarket.com) - Discover MCP servers that connect Claude and Cursor to tools like Figma, Databricks, Storybook, and ...

9. [MCP Registry Actor · Apify](https://apify.com/epicmotionsd/mcp-registry-discovery) - What is this Actor? The MCP Registry Actor provides AI agents and developers with programmatic acces...

10. [MCP Registry: API Interface for Model Context Protocol Servers](https://mcpmarket.com/server/registry-5) - mcp-registry provides a standardized interface for the Model Context Protocol (MCP) Registry API. De...

11. [modelcontextprotocol/servers: Model Context Protocol ... - GitHub](https://github.com/modelcontextprotocol/servers) - This repository is a collection of reference implementations for the Model Context Protocol (MCP), a...

12. [I analyzed 1400 MCP servers - here's what I learned - Bloomberry](https://bloomberry.com/blog/we-analyzed-1400-mcp-servers-heres-what-we-learned/) - Last Updated: March 27, 2026MCP has generated enormous excitement in the past few months. But there’...

13. [MCP Adoption Statistics 2025](https://mcpmanager.ai/blog/mcp-adoption-statistics/) - As of today (10/22/2025), the popular MCP registry, PulseMCP, has over 5,500 servers listed on it. H...

## Relevant Skills

- [[airi-mcp-integration]]
