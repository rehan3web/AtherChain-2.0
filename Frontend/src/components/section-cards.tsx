import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export interface SectionCardsProps {
  stats?: {
    user: {
      balanceAT: string;
      balanceATH: string;
    };
    referrals: {
      total: number;
    };
    mining: {
      canMine: boolean;
      timeLeft: number;
      dailyReward: number;
      isPaused?: boolean;
    }
  }
}

export function SectionCards({ stats }: SectionCardsProps) {
  const atReserves = stats ? parseFloat(stats.user.balanceAT).toLocaleString() : "0";
  const athLiquidity = stats ? parseFloat(stats.user.balanceATH).toFixed(2) : "0.00";
  const nodeReferrals = stats ? stats.referrals.total : 0;
  const miningPerformance = stats ? stats.mining.dailyReward.toString() : "0";

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>AT Reserves</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {atReserves} <span className="text-sm font-normal text-muted-foreground">AT</span>
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +{miningPerformance} Daily
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Internal Mining Credits
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>ATH Liquidity</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {athLiquidity} <span className="text-sm font-normal text-muted-foreground">ATH</span>
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              Like Balance
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Mainnet Portfolio
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Node Referrals</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {nodeReferrals} <span className="text-sm font-normal text-muted-foreground">Nodes</span>
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              Infinite Growth
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Network Expansion
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Mining Performance</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {miningPerformance} <span className="text-sm font-normal text-muted-foreground">AT/24H</span>
          </CardTitle>
          <CardAction>
            {stats?.mining.isPaused ? (
              <Badge variant="destructive">
                Restricted
              </Badge>
            ) : (
              <Badge variant="outline">
                <IconTrendingUp />
                Optimal Output
              </Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className={cn("line-clamp-1 flex gap-2 font-medium", stats?.mining.isPaused && "text-destructive")}>
            {stats?.mining.isPaused ? "Protocol extraction suspended" : "Standard Protocol"}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}