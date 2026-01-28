"use client";
import { API_URL } from "../../../../lib/config";
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

const hostname =
  typeof window !== "undefined" ? window.location.hostname : "localhost";

const wsProtocol =
  typeof window !== "undefined" && window.location.protocol === "https:"
    ? "wss"
    : "ws";

const WS_URL = `${wsProtocol}://${hostname}:3001/api/order`;

export default function KitchenQueue() {
  const [queue, setQueue] = useState<Order[]>([]);
  const [servingQueue, setServingQueue] = useState<Order[]>([]); // ✅ FIFO queue
  const [nowServing, setNowServing] = useState<Order | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const nextServing = servingQueue.length > 0 ? servingQueue[0] : null;

  // Clear all orders
  const clearQueue = async () => {
    try {
      await fetch(`${API_URL}/api/order/`, { method: "DELETE" });
      setQueue([]);
      setServingQueue([]);
      setNowServing(null);
    } catch (err) {
      console.error("Failed to clear queue:", err);
    }
  };

  // ✅ Enqueue order instead of replacing Now Serving
  const serveOrder = async (orderId: number) => {
    const order = queue.find((o) => o.id === orderId);
    if (!order) return;

    try {
      await fetch(`${API_URL}/api/order/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "served" }),
      });

      setQueue((prev) => prev.filter((o) => o.id !== orderId));

      setServingQueue((prev) => {
        if (prev.find((o) => o.id === orderId)) return prev; // prevent duplicates
        return [...prev, order];
      });
    } catch (err) {
      console.error("Failed to serve order:", err);
    }
  };

  // ✅ FIFO processing logic
  useEffect(() => {
    if (nowServing || servingQueue.length === 0) return;

    const nextOrder = servingQueue[0];
    setNowServing(nextOrder);
    setServingQueue((prev) => prev.slice(1));

    timerRef.current = setTimeout(() => {
      setNowServing(null);
    }, 100000); // keep your existing timing
  }, [servingQueue, nowServing]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    wsRef.current = new WebSocket(WS_URL);

    wsRef.current.onopen = () => console.log("✅ WebSocket connected");
    wsRef.current.onclose = () => console.log("❌ WebSocket disconnected");

    wsRef.current.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "init") {
          const confirmedOrders = (data.orders as Order[]).filter(
            (o) => o.status === "confirmed",
          );
          setQueue(confirmedOrders.sort((a, b) => a.id - b.id));
        }

        if (data.type === "new_order" || data.type === "status_update") {
          const o: Order = data.order;
          if (o.status === "confirmed") {
            setQueue((prev) => {
              const map = new Map(prev.map((order) => [order.id, order]));
              map.set(o.id, o);
              return Array.from(map.values()).sort((a, b) => a.id - b.id);
            });
          }
        }

        if (data.type === "order_removed") {
          setQueue((prev) => prev.filter((o) => o.id !== data.orderId));
          setServingQueue((prev) => prev.filter((o) => o.id !== data.orderId));
          if (nowServing?.id === data.orderId) setNowServing(null);
        }

        if (data.type === "clear") {
          setQueue([]);
          setServingQueue([]);
          setNowServing(null);
        }
      } catch (err) {
        console.error("WebSocket parse error:", err, event.data);
      }
    };

    return () => wsRef.current?.close();
  }, [nowServing]);

  // ================= UI (UNCHANGED) =================
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header
        className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3"
        style={{
          backgroundColor: "#670E10",
          color: "#fff",
          textShadow: "2px 2px 6px #000",
        }}
      >
        <div className="container mx-auto flex flex-wrap p-5 flex-col md:flex-row items-center justify-center">
          <a className="flex title-font font-medium items-center text-gray-900 mb-4 md:mb-0">
            <img src="/SFAC_LOGO_Edited.png" alt="Logo" className="w-10 h-10" />
            <span className="xl-3 text-xl text-white">THE FRANCISCanteen</span>
          </a>
        </div>
      </header>

      <main className="container px-5 pt-12 pb-28 mx-auto flex flex-col-reverse md:flex-row items-start bg-gray-100 rounded-lg gap-8 flex-grow overflow-hidden">
        {/* Queue list */}
        <div className="md:w-1/2 w-full flex flex-col space-y-6 md:pr-12 order-1 overflow-y-auto max-h-full">
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
                Order {order.orderCode ?? `#${order.id}`} ({order.items.length}{" "}
                item
                {order.items.length > 1 ? "s" : ""})
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
        <div className="md:w-1/2 w-full flex items-center justify-center order-2 -mt-10">
          <div
            className="bg-white rounded-xl shadow-2xl 
                w-full max-w-md text-center
                px-6 py-8 sm:px-10 sm:py-12 md:px-16 md:py-16
                flex flex-col justify-center"
          >
            <h2
              className="text-3xl sm:text-4xl md:text-5xl 
               font-extrabold mb-6 text-gray-800
               px-2 break-words"
            >
              Now Serving
            </h2>
            {nowServing ? (
              <div className="space-y-4">
                <p
                  className="text-2xl sm:text-3xl md:text-6xl 
              text-gray-600 leading-tight
              break-words px-2"
                >
                  Order {nowServing.orderCode ?? `#${nowServing.id}`}
                </p>
                {nextServing && (
                  <p
                    className="text-sm sm:text-base md:text-xl 
              text-gray-500 break-words px-2"
                  >
                    Next: Order {nextServing.orderCode ?? `#${nextServing.id}`}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
                Click an order on the left to serve it
              </p>
            )}
          </div>
        </div>
      </main>

      <footer
        id="footer"
        className="footer sm:footer-horizontal footer-center bg-base-300 text-base-content p-4 mt-auto"
        style={{
          backgroundColor: "#670E10",
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          zIndex: 10,
        }}
      >
        <aside className="text-center m-0 text-white">
          <p>
            Copyright © {new Date().getFullYear()} - All rights reserved by
            Saint Francis of Assisi College Las Piñas Campus.
          </p>
        </aside>
      </footer>
    </div>
  );
}
