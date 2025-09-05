import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RoomCellProps {
  roomNumber: string;
  status: "paid" | "pending" | "overdue" | "vacant";
  tenant?: string;
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

export default function RoomCell({ roomNumber, status, tenant }: RoomCellProps) {
  const handleClick = () => {
    // TODO: Open room details modal
    console.log(`Show details for room ${roomNumber}`);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            "aspect-square flex items-center justify-center rounded-md text-xs font-medium transition-all duration-200 hover:scale-105 hover:shadow-md",
            statusStyles[status]
          )}
          onClick={handleClick}
          data-testid={`room-cell-${roomNumber}`}
        >
          {roomNumber}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm">
          <div className="font-medium">Room {roomNumber}</div>
          <div>Status: {statusLabels[status]}</div>
          {tenant && <div>Tenant: {tenant}</div>}
          {!tenant && status === "vacant" && <div>Available for rent</div>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
