import { cn } from "../../lib/utils";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { CreditCard } from "lucide-react";
import QuickMpesaForm from "../payments/quick-mpesa-form";

interface RoomCellProps {
  roomNumber: string;
  status: "paid" | "pending" | "overdue" | "vacant";
  tenant?: string;
  roomId?: string;
  tenantId?: string;
  amount?: string;
}

const statusStyles = {
  paid: "bg-green-500 text-white hover:bg-green-600",
  pending: "bg-yellow-500 text-white hover:bg-yellow-600",
  overdue: "bg-red-500 text-white hover:bg-red-600",
  vacant: "bg-gray-400 text-gray-700 hover:bg-gray-500",
};

const statusLabels = {
  paid: "Paid",
  pending: "Pending",
  overdue: "Overdue",
  vacant: "Vacant",
};

export default function RoomCell({ roomNumber, status, tenant, roomId, tenantId, amount }: RoomCellProps) {
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  
  const handleClick = () => {
    if (status === "pending" || status === "overdue") {
      setShowPaymentDialog(true);
    } else {
      // Show room details for other statuses
      console.log(`Show details for room ${roomNumber}`);
    }
  };

  const shouldShowPayButton = status === "pending" || status === "overdue";

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="aspect-square relative group">
            <button
              className={cn(
                "w-full h-full flex flex-col items-center justify-center rounded-md text-xs font-medium transition-all duration-200 hover:scale-105 hover:shadow-md",
                statusStyles[status]
              )}
              onClick={handleClick}
              data-testid={`room-cell-${roomNumber}`}
            >
              <div className="text-xs font-bold">{roomNumber}</div>
              {shouldShowPayButton && (
                <div className="mt-1 flex items-center gap-1 text-[10px] font-extrabold bg-white/20 px-1 py-0.5 rounded backdrop-blur-sm">
                  <CreditCard className="w-2 h-2" />
                  PAY NOW
                </div>
              )}
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <div className="font-medium">Room {roomNumber}</div>
            <div>Status: {statusLabels[status]}</div>
            {tenant && <div>Tenant: {tenant}</div>}
            {!tenant && status === "vacant" && <div>Available for rent</div>}
            {shouldShowPayButton && <div className="text-blue-300 font-medium">💳 Click to pay rent</div>}
          </div>
        </TooltipContent>
      </Tooltip>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay Rent - Room {roomNumber}</DialogTitle>
            {tenant && <p className="text-sm text-muted-foreground">Tenant: {tenant}</p>}
          </DialogHeader>
          <QuickMpesaForm
            roomId={roomId}
            tenantId={tenantId}
            amount={amount}
            onClose={() => setShowPaymentDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
