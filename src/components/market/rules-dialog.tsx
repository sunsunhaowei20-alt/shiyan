"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { marketStore } from "@/lib/market/store";
import type { Snapshot } from "@/lib/market/types";

export function RulesDialog({ snapshot }: { snapshot: Snapshot }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>规则</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>模拟交易规则</DialogTitle>
          <DialogDescription>
            市演只在这台浏览器里撮合，不连接真实行情，也不能把单子送到交易所。
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
          <li>初始资金 100 万元。持仓、委托和时钟保存在本地。</li>
          <li>价格按几何布朗运动走动，同行业会一起波动，随机快讯会打出一个缺口。</li>
          <li>红涨绿跌。主板和 ETF 涨跌停 10%，创业板、科创板 20%。</li>
          <li>买卖 100 股一手。佣金万 2.5，最低 5 元；卖出另收印花税 0.05%。</li>
          <li>连续竞价时段是交易日 9:30–11:30、13:00–15:00。</li>
        </ul>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={snapshot.tPlusOne ? "secondary" : "outline"}
            onClick={() => marketStore.setTPlusOne(!snapshot.tPlusOne)}
          >
            {snapshot.tPlusOne ? "T+1 已开启" : "T+1 已关闭"}
          </Button>
          <Button
            type="button"
            variant={snapshot.skipClosed ? "secondary" : "outline"}
            onClick={() => marketStore.setSkipClosed(!snapshot.skipClosed)}
          >
            {snapshot.skipClosed ? "休市自动跳过" : "休市原地等待"}
          </Button>
        </div>
        {confirming ? (
          <div className="space-y-2 rounded-lg bg-muted p-3">
            <p className="text-sm">清空持仓和委托，资金回到 100 万？这个操作不能撤销。</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-rise text-white hover:bg-rise/90"
                onClick={() => {
                  marketStore.reset();
                  setConfirming(false);
                }}
              >
                确认重置
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
            重置账户
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
