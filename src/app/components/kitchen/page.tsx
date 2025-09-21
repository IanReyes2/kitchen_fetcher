"use client";

import { useEffect, useState, useRef } from "react";

interface Item {
  id: number;
  name: string;
  price: number;
  quantity: number;
  available: boolean;
  category: string;
  image: string;
}

interface Order {
  id: number;
  items: Item[];
  total: number;
  status?: string;
}

export default function KitchenQueue() {
  const [queue, setQueue] = useState<Order[]>([]);
  const [nowServing, setNowServing] = useState<Item | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    wsRef.current = new WebSocket("ws://192.168.1.2:3001");

    wsRef.current.onopen = () => console.log("WebSocket connected");
    wsRef.current.onclose = () => console.log("WebSocket disconnected");

    wsRef.current.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      // Initialize existing orders
      if (data.type === "init") {
        const pendingOrders = data.orders.filter((o: Order) => o.status === "pending");
        setQueue(pendingOrders.sort((a: Order, b: Order) => a.id - b.id));
      }

      // New order broadcast
      if (data.type === "new_order") {
        if (data.order.status === "pending") {
          setQueue((prev) => [...prev, data.order].sort((a, b) => a.id - b.id));
        }
      }

      // Status update
      if (data.type === "status_update") {
        setQueue((prev) =>
          prev
            .map((o) => (o.id === data.order.id ? data.order : o))
            .filter((o) => o.status === "pending")
            .sort((a, b) => a.id - b.id)
        );
      }
    };

    return () => wsRef.current?.close();
  }, []);

  // Serve first item in the first order
  const serveItem = () => {
    if (queue.length === 0) return;

    const firstOrder = queue[0];
    const [firstItem, ...remainingItems] = firstOrder.items;

    setNowServing(firstItem);

    // Update queue locally
    if (remainingItems.length > 0) {
      setQueue([{ ...firstOrder, items: remainingItems }, ...queue.slice(1)]);
    } else {
      setQueue(queue.slice(1)); // remove order if all items served
    }
  };

  // Clear nowServing after 10 seconds
useEffect(() => {
  if (!nowServing) return;

  const timer = setTimeout(() => {
    setNowServing(null);
  }, 10000); // 10 seconds

  return () => clearTimeout(timer);
}, [nowServing]);


  return (
    <div className="min-h-screen flex flex-col">

      {/* Header */}
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

      {/* Main content */}
      <main className="flex-1 container px-5 py-12 mx-auto flex flex-col-reverse md:flex-row items-start bg-gray-100 rounded-lg gap-8">

        {/* Left side: grouped orders */}
        <div className="md:w-1/2 w-full flex flex-col space-y-6 md:pr-12 order-1">
          {queue.length === 0 && (
            <p className="text-gray-600 text-center">
              Waiting for cashier to approve orders...
            </p>
          )}

          {queue.map((order, index) => (
            <div
              key={order.id}
              onClick={index === 0 ? serveItem : undefined} // only first order clickable
              className={`block p-6 border rounded-lg shadow-sm transition
                ${index === 0 ? "bg-white hover:bg-gray-100 cursor-pointer" : "bg-gray-200 cursor-not-allowed"}
              `}
            >
              <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900">
                Order #{order.id} ({order.items.length} item{order.items.length > 1 ? "s" : ""})
              </h5>

              <ul className="list-disc list-inside text-gray-700">
                {order.items.map((item) => (
                  <li key={`${order.id}-${item.id}`}>
                    {item.name} (x{item.quantity}) - ₱{item.price}
                  </li>
                ))}
              </ul>

              <p className="mt-2 font-semibold text-gray-700">Total: ₱{order.total}</p>
            </div>
          ))}
        </div>

        {/* Right side: Now Serving */}
        <div className="md:w-1/2 w-full flex items-center justify-center order-2">
          <div className="bg-white rounded-xl shadow-2xl p-16 w-full max-w-md text-center">
            <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-gray-800">
              Now Serving
            </h2>
            {nowServing ? (
              <div>
                <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
                  {nowServing.name} (x{nowServing.quantity})
                </p>
                <p className="mt-4 font-semibold text-gray-700">
                  Price: ₱{nowServing.price}
                </p>
              </div>
            ) : (
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
                Click the top order on the left to start serving
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer sm:footer-horizontal footer-center bg-base-300 text-base-content p-4 mt-auto">
        <aside>
          <p>
            Copyright © {new Date().getFullYear()} - All right reserved by Saint Francis of Assisi College Las Piñas Campus.
          </p>
        </aside>
      </footer>
    </div>
  );
}
