import React from "react";
import { useAuth } from "../api/AuthContext";
import { api } from "../api/client";
import { Table, TableHeader, TableRow, TableCell, Badge } from "../components/Table";

interface PendingSubscriptionRequest {
  id: string;
  email: string;
  tier: "starter" | "growth" | "enterprise";
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
}

interface TableColumn {
  accessorKey: keyof PendingSubscriptionRequest;
  header: string;
  size?: string;
}

export default function ManagementSubscriptionsPage() {
  const { company, user, isHrAdmin, isSuperAdmin } = useAuth();

  if (!isHrAdmin && !isSuperAdmin) {
    return null; // or <Navigate to="/dashboard" replace />;
  }

  const [requests, setRequests] = React.useState<PendingSubscriptionRequest[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const data = await api.subscriptionsListPending();
      setRequests(data.requests);
    } catch (err: any) {
      console.error("Failed to load pending subscriptions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      await api.subscriptionsApprove(requestId);
      loadRequests();
    } catch (err: any) {
      console.error("Failed to approve subscription:", err);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await api.subscriptionsReject(requestId);
      loadRequests();
    } catch (err: any) {
      console.error("Failed to reject subscription:", err);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="empty">Loading pending subscription requests...</div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="page">
        <div className="empty">
          <h3>No pending subscription requests</h3>
          <p>There are currently no pending subscription requests for this company.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Pending Subscription Requests</h2>
          <p className="muted">
            View and manage subscription tier upgrade requests awaiting payment verification.
          </p>
        </div>
      </div>

      <div className="table-responsive">
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Requested Tier</TableCell>
              <TableCell>Status</TableCell>
              <TableCell style={{ width: "140px" }}>Actions</TableCell>
            </TableRow>
          </TableHeader>
          {requests.map((req) => (
            <Table key={req.id} row>
              <TableRow>
                <TableCell>{req.email}</TableCell>
                <TableCell>
                  {req.tier.charAt(0).toUpperCase() + req.tier.slice(1)} /
                  {req.tier === "starter"
                    ? "Starter / Small Business"
                    : req.tier === "growth"
                    ? "Growth / Pro Tier"
                    : "Enterprise Tier"}
                </TableCell>
                <TableCell>
                  <Badge
                    status={req.status}
                    variant={
                      req.status === "pending"
                        ? "outline"
                        : req.status === "approved"
                        ? "success"
                        : "destructive"
                    }
                  >
                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => handleApprove(req.id)}
                    className="btn btn-sm btn-primary"
                    disabled={req.status !== "pending"}
                  >
                    Approve / Unlock Tier
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    className="btn btn-sm btn-secondary"
                    disabled={req.status !== "pending"}
                  >
                    Reject
                  </button>
                </TableCell>
              </TableRow>
            </Table>
          ))}
        </Table>
      </div>
    </div>
  );
}