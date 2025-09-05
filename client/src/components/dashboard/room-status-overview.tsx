interface RoomStatusOverviewProps {
  roomStatusCounts: {
    paid: number;
    pending: number;
    overdue: number;
    vacant: number;
  };
}

export default function RoomStatusOverview({ roomStatusCounts }: RoomStatusOverviewProps) {
  return (
    <div className="bg-card rounded-xl p-6 border border-border" data-testid="card-room-overview">
      <h3 className="text-lg font-semibold text-foreground mb-4">Quick Room Overview</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-foreground">Paid</span>
          </div>
          <span className="text-lg font-bold text-green-600" data-testid="text-rooms-paid">
            {roomStatusCounts.paid}
          </span>
        </div>
        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-sm font-medium text-foreground">Pending</span>
          </div>
          <span className="text-lg font-bold text-yellow-600" data-testid="text-rooms-pending">
            {roomStatusCounts.pending}
          </span>
        </div>
        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm font-medium text-foreground">Overdue</span>
          </div>
          <span className="text-lg font-bold text-red-600" data-testid="text-rooms-overdue">
            {roomStatusCounts.overdue}
          </span>
        </div>
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            <span className="text-sm font-medium text-foreground">Vacant</span>
          </div>
          <span className="text-lg font-bold text-gray-600" data-testid="text-rooms-vacant">
            {roomStatusCounts.vacant}
          </span>
        </div>
      </div>
    </div>
  );
}
