"use client";
import { API_URL } from "../../../../lib/config"; // adjust path if needed
import { useEffect, useState, useRef } from "react";

interface Item {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: number;
  orderCode?: string;
  items: Item[];
  total: number;
  status?: string;
}

const WS_URL = "ws://192.168.254.119:3001/api/order"; // backend WebSocket

export default function KitchenQueue() {
  const [queue, setQueue] = useState<Order[]>([]);
  const [nowServing, setNowServing] = useState<Order | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ✅ Clear all orders
  const clearQueue = async () => {
    try {
      await fetch(`${API_URL}/api/order/`, { method: "DELETE" }); // <-- fixed URL
      setQueue([]);
      setNowServing(null);
    } catch (err) {
      console.error("Failed to clear queue:", err);
    }
  };

  // ✅ Serve a single order
  const serveOrder = async (orderId: number) => {
    const order = queue.find((o) => o.id === orderId);
    if (!order) return;

    try {
      await fetch(`${API_URL}/api/order/${orderId}/`, { // <-- fixed URL
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "served" }),
      });

      setNowServing(order);
      setQueue((prev) => prev.filter((o) => o.id !== orderId));

      setTimeout(() => setNowServing(null), 5000);
    } catch (err) {
      console.error("Failed to serve order:", err);
    }
  };

  useEffect(() => {
    wsRef.current = new WebSocket(WS_URL);

    wsRef.current.onopen = () => console.log("✅ WebSocket connected");
    wsRef.current.onclose = () => console.log("❌ WebSocket disconnected");

    wsRef.current.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "init") {
          const confirmedOrders = (data.orders as Order[]).filter(
            (o) => o.status === "pending"
          );
          setQueue(confirmedOrders.sort((a, b) => a.id - b.id));
        }

        if (data.type === "new_order" || data.type === "status_update") {
          const o: Order = data.order;
          if (o.status === "pending") {
            setQueue((prev) => {
              const map = new Map(prev.map((order) => [order.id, order]));
              map.set(o.id, o);
              return Array.from(map.values()).sort((a, b) => a.id - b.id);
            });
          }
        }

        if (data.type === "order_removed") {
          setQueue((prev) => prev.filter((o) => o.id !== data.orderId));
          if (nowServing?.id === data.orderId) setNowServing(null);
        }

        if (data.type === "clear") {
          setQueue([]);
          setNowServing(null);
        }
      } catch (err) {
        console.error("WebSocket parse error:", err, event.data);
      }
    };

    return () => wsRef.current?.close();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="text-gray-600 body-font">
        <div className="container mx-auto flex flex-wrap p-5 flex-col md:flex-row items-center justify-center">
          <a className="flex title-font font-medium items-center text-gray-900 mb-4 md:mb-0">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-10 h-10 text-white p-2 bg-indigo-500 rounded-full"
            />
            <span className="ml-3 text-xl">The FrancisCanteen</span>
          </a>
        </div>
      </header>

      <main className="flex-1 container px-5 py-12 mx-auto flex flex-col-reverse md:flex-row items-start bg-gray-100 rounded-lg gap-8">
        {/* Queue list */}
        <div className="md:w-1/2 w-full flex flex-col space-y-6 md:pr-12 order-1">
          {queue.length === 0 && (
            <p className="text-gray-600 text-center">
              Waiting for cashier to approve orders...
            </p>
          )}

          {queue.map((order) => (
            <div
              key={order.id}
              onClick={() => serveOrder(order.id)}
              className="block p-6 border rounded-lg shadow-sm bg-white hover:bg-gray-100 cursor-pointer transition"
            >
              <h5 className="mb-2 text-2xl font-bold text-gray-900">
                Order {order.orderCode ?? `#${order.id}`} (
                {order.items.length} item{order.items.length > 1 ? "s" : ""})
              </h5>
              <ul className="list-disc list-inside text-gray-700">
                {order.items.map((item, idx) => (
                  <li key={`${order.id}-${item.id ?? idx}`}>
                    {item.name} (x{item.quantity}) – ₱{item.price}
                  </li>
                ))}
              </ul>
              <p className="mt-2 font-semibold text-gray-700">
                Total: ₱{order.total}
              </p>
            </div>
          ))}

          {queue.length > 0 && (
            <button
              onClick={clearQueue}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 mt-4"
            >
              Clear Orders
            </button>
          )}
        </div>

        {/* Now serving */}
        <div className="md:w-1/2 w-full flex items-center justify-center order-2">
          <div className="bg-white rounded-xl shadow-2xl p-16 w-full max-w-md text-center">
            <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-gray-800">
              Now Serving
            </h2>
            {nowServing ? (
              <div>
                <p className="text-6xl md:text-8xl text-gray-600 leading-relaxed">
                  Order {nowServing.orderCode ?? `#${nowServing.id}`}
                </p>
                <ul className="list-disc list-inside text-gray-700 text-left mt-4">
                  {nowServing.items.map((item, idx) => (
                    <li key={`${nowServing.id}-${idx}`}>
                      {item.name} (x{item.quantity})
                    </li>
                  ))}
                </ul>
                <p className="mt-4 font-semibold text-gray-700">
                  Total: ₱{nowServing.total}
                </p>
              </div>
            ) : (
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
                Click an order on the left to serve it
              </p>
            )}
          </div>
        </div>
      </main>

      <footer className="footer sm:footer-horizontal footer-center bg-base-300 text-base-content p-4 mt-auto">
        <aside>
          <p>
            Copyright © {new Date().getFullYear()} - All rights reserved by Saint
            Francis of Assisi College Las Piñas Campus.
          </p>
        </aside>
      </footer>
    </div>
  );
}
