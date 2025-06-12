<!--
© 2025 TechnicallyWeb3 – Licensed under AGPL-3.0
-->

# Common WTTP Use Cases

## Real-World Applications of Blockchain Web Hosting

WTTP isn't just a technical experiment—it's solving real problems for real people. Here are the most popular ways developers and organizations are using WTTP today.

---

## 🏠 Static Website Hosting

**Perfect for:** Personal websites, portfolios, documentation sites, landing pages

**Why WTTP?**
- No monthly hosting fees
- Truly censorship-resistant
- Permanent uptime (as long as blockchain exists)
- Version control built-in

**Example:** A developer's portfolio that will never go offline

```bash
# Deploy your portfolio site
npx hardhat run scripts/deploy-site.js --network mainnet

# Upload your entire site
npx hardhat run scripts/upload-folder.js --network mainnet
# Prompts: ./portfolio-website/ → /
```

**Cost comparison:**
- Traditional hosting: $5-20/month forever
- WTTP: One-time gas fee (~$50-200 depending on site size)

---

## 📝 Decentralized Blogging

**Perfect for:** Journalists, activists, independent writers, whistleblowers

**Why WTTP?**
- Cannot be taken down by authorities
- No platform can ban your content
- You own your audience and data
- Built-in economic incentives for readers

**Example:** A journalist's uncensorable blog

```javascript
// Add new blog post
await wttpSite.PUT(
  "/posts/2024-01-15-my-investigation.html",
  blogPostContent,
  "text/html"
);

// Update blog index
await wttpSite.PATCH("/index.html", updatedIndexContent);
```

**Real impact:** Journalists in authoritarian countries using WTTP to publish investigations that can't be censored.

---

## 📁 Document Storage & Sharing

**Perfect for:** Legal firms, researchers, activists, organizations

**Why WTTP?**
- Immutable records (perfect for legal evidence)
- Controlled access with granular permissions
- No risk of files being "lost" by cloud providers
- Transparent audit trails

**Example:** Legal firm storing case documents

```bash
# Upload confidential documents
npx hardhat run scripts/put-file.js --network mainnet
# File: case-123-evidence.pdf
# Access: Only CLIENT_ROLE can read

# Grant access to specific lawyer
npx hardhat run scripts/grant-role.js --network mainnet
# Role: CLIENT_ROLE
# Address: 0x742d35Cc6523C0532...
```

**Permission levels:**
- **ADMIN**: Firm partners
- **LAWYER_ROLE**: Case lawyers
- **CLIENT_ROLE**: Specific clients
- **AUDITOR_ROLE**: Court-appointed reviewers

---

## 🔗 API Endpoints

**Perfect for:** DApps, microservices, data feeds, IoT devices

**Why WTTP?**
- RESTful APIs that live on blockchain
- No server maintenance
- Automatic load balancing (blockchain nodes)
- Economic incentives for data providers

**Example:** Weather data API

```javascript
// Store weather data
await wttpSite.PUT("/api/weather/2024-01-15.json", {
  temperature: 72,
  humidity: 45,
  location: "San Francisco",
  timestamp: 1705363200
});

// Your app fetches data
const weather = await wttpSite.GET("/api/weather/2024-01-15.json");
```

**Revenue model:** Charge ESP fees for data access, creating sustainable data businesses.

---

## 🖼️ NFT Metadata & Media

**Perfect for:** NFT creators, digital artists, game developers

**Why WTTP?**
- Truly decentralized metadata (not just IPFS links)
- Cannot be rug-pulled by centralized servers
- Programmable royalties through ESP
- Version control for evolving NFTs

**Example:** Dynamic NFT with evolving artwork

```javascript
// Initial NFT metadata
await wttpSite.PUT("/nft/1/metadata.json", {
  name: "Evolving Artwork #1",
  description: "This artwork changes over time",
  image: "/nft/1/image-v1.png",
  attributes: [...]
});

// Update artwork after community milestone
await wttpSite.PATCH("/nft/1/image-v2.png", newArtworkData);
await wttpSite.PATCH("/nft/1/metadata.json", updatedMetadata);
```

**Benefit:** NFT holders never lose their media, even if the creator disappears.

---

## 🎮 Game Asset Storage

**Perfect for:** Game developers, especially indie and Web3 games

**Why WTTP?**
- Player-owned game assets
- Cross-game asset portability
- Permanent game preservation
- Community-driven content

**Example:** RPG character data

```javascript
// Store player character
await wttpSite.PUT("/characters/player123.json", {
  name: "Dragonslayer",
  level: 45,
  equipment: [...],
  achievements: [...],
  stats: {...}
});

// Other games can read this data (with permission)
const character = await wttpSite.GET("/characters/player123.json");
```

**Vision:** Players truly own their characters and can take them between compatible games.

---

## 📚 Educational Content

**Perfect for:** Educators, course creators, researchers

**Why WTTP?**
- Permanent educational resources
- Cannot be paywalled by platforms
- Students can verify content authenticity
- Economic rewards for quality content

**Example:** Decentralized online course

```
/course/
├── syllabus.md
├── lesson-1/
│   ├── content.md
│   ├── video.mp4
│   └── exercises.json
├── lesson-2/
└── ...
```

**Access control:**
- Free preview lessons: PUBLIC_ROLE
- Full course: STUDENT_ROLE (purchased access)
- Instructor materials: TEACHER_ROLE

---

## 🏛️ Organizational Transparency

**Perfect for:** DAOs, nonprofits, government agencies, public companies

**Why WTTP?**
- Transparent decision-making records
- Immutable audit trails
- Public accountability
- Decentralized governance documents

**Example:** DAO governance site

```javascript
// Publish proposal
await wttpSite.PUT("/proposals/WTTP-001.md", proposalContent);

// Record voting results
await wttpSite.PUT("/votes/WTTP-001-results.json", {
  proposal: "WTTP-001",
  totalVotes: 1247,
  yesVotes: 892,
  noVotes: 355,
  status: "PASSED",
  executionDate: "2024-02-01"
});
```

**Public trust:** All decisions are permanently recorded and verifiable.

---

## 💼 Professional Services

**Perfect for:** Consultants, freelancers, agencies

**Why WTTP?**
- Showcase work that can't be taken down
- Build reputation through immutable portfolio
- Direct client payments through ESP
- No platform fees

**Example:** Design agency portfolio

```
/portfolio/
├── index.html
├── projects/
│   ├── acme-corp-rebrand/
│   ├── startup-xyz-website/
│   └── nonprofit-campaign/
├── testimonials.json
└── contact.html
```

**Client benefits:**
- Verify agency's actual past work
- Permanent case study access
- Direct economic relationship (no middleman)

---

## 🔧 Technical Infrastructure

**Perfect for:** DevOps teams, system administrators, monitoring services

**Why WTTP?**
- Configuration files that can't be accidentally deleted
- Incident response playbooks
- Monitoring data storage
- Disaster recovery documentation

**Example:** Infrastructure documentation

```
/infra/
├── runbooks/
│   ├── database-failover.md
│   ├── scaling-procedures.md
│   └── incident-response.md
├── configs/
│   ├── nginx.conf
│   ├── docker-compose.yml
│   └── k8s-manifests/
└── monitoring/
    └── dashboards.json
```

**Reliability:** Critical documentation survives even if your company's infrastructure fails.

---

## 🌍 Global Collaboration

**Perfect for:** International projects, research collaborations, humanitarian efforts

**Why WTTP?**
- No geographical restrictions
- Resistant to political interference
- Unified global access
- Economic incentives for contributors

**Example:** Open research project

```javascript
// Research data contribution
await wttpSite.PUT("/data/climate-measurements-2024.csv", climateData);

// Analysis results
await wttpSite.PUT("/analysis/temperature-trends.md", analysisReport);

// Peer review comments
await wttpSite.PATCH("/reviews/paper-v2-comments.json", peerReviews);
```

**Global impact:** Researchers worldwide can contribute and access critical data regardless of local internet restrictions.

---

## 🚀 Getting Started with Your Use Case

1. **Identify your needs:** Which use case matches your project?
2. **Plan your structure:** How will you organize your files and permissions?
3. **Start small:** Deploy a simple version first
4. **Iterate:** Use WTTP's PATCH method to evolve your content
5. **Engage community:** Leverage ESP economics to build your audience

**Ready to build?** Check out our [step-by-step tutorials](../tutorials/) for your specific use case!

---

## 💡 Creative Ideas We'd Love to See

- **Decentralized Wikipedia**: Community-maintained knowledge base
- **Permanent Art Galleries**: Digital art exhibitions that last forever
- **Whistleblower Platforms**: Secure, anonymous document sharing
- **Local Community Boards**: Neighborhood information sharing
- **Academic Paper Archives**: Permanent, accessible research
- **Family History Sites**: Genealogy that survives generations
- **Emergency Information Systems**: Disaster-resistant public information

**Have a unique use case?** We'd love to hear about it! Share your project in our [Discord community](https://discord.gg/wttp).

**The decentralized web is just getting started—what will you build?** 🌐✨ 