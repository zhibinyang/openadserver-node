import { Controller, Get, Header } from '@nestjs/common';

@Controller('paapi')
export class PaapiController {
    @Get('decision-logic.js')
    @Header('Content-Type', 'application/javascript')
    @Header('Ad-Auction-Allowed', 'true')
    getDecisionLogic() {
        return `function scoreAd(adMetadata, bid, auctionConfig, trustedScoringSignals, browserSignals) {
  return bid;
}

function reportResult(auctionConfig, browserSignals) {
  return { "success": true };
}`;
    }

    @Get('bidding-logic.js')
    @Header('Content-Type', 'application/javascript')
    @Header('Ad-Auction-Allowed', 'true')
    getBiddingLogic() {
        return `function generateBid(interestGroup, auctionSignals, perBuyerSignals, trustedBiddingSignals, browserSignals) {
  return {
    bid: 15,
    render: interestGroup.ads[0].renderUrl,
    ad: { id: 'test-ad-001' }
  };
}

function reportWin(auctionSignals, perBuyerSignals, sellerSignals, browserSignals) {
  console.log("I won the auction!");
}`;
    }

    @Get('ad-creative.html')
    @Header('Content-Type', 'text/html')
    @Header('Supports-Loading-Mode', 'fenced-frame')
    getAdCreative() {
        return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; overflow:hidden;">
    <img src="https://res.cloudinary.com/dr6wljwzj/image/upload/v1770253999/laptop_display_728_90_t0gzhc.jpg" style="width:100%; height:100%; object-fit:contain;" />
  </body>
</html>`;
    }

    @Get('join.html')
    @Header('Content-Type', 'text/html')
    getJoinHtml() {
        return `<!DOCTYPE html>
<html>
<body>
  <script>
    // 这里的代码运行在 ads.zhibinyang.net 域名下
    var myGroup = {
      owner: 'https://ads.zhibinyang.net', // 恢复为你的 AdServer 域名
      name: 'test-sneakers',
      biddingLogicUrl: 'https://ads.zhibinyang.net/paapi/bidding-logic.js',
      ads: [{
        renderUrl: 'https://ads.zhibinyang.net/paapi/ad-creative.html',
        metadata: { type: 'sneaker', baseBid: 10 }
      }]
    };

    if (navigator.joinAdInterestGroup) {
      navigator.joinAdInterestGroup(myGroup, 30 * 24 * 60 * 60)
        .then(function() { console.log("Iframe: Joined IG via ads.zhibinyang.net"); })
        .catch(function(e) { console.error("Iframe error:", e); });
    }
  </script>
</body>
</html>`;
    }
}
