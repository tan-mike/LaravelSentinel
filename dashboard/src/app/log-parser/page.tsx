"use client";

import LogParser from "@/components/LogParser";
import Link from "next/link";

export default function LogParserPage() {
  return (
    <div className="container h-screen flex flex-col py-6">
      <div className="mb-4 flex justify-between items-center shrink-0">
         <div>
            <Link href="/" className="text-gray-400 hover:text-white mb-2 inline-block text-sm">&larr; Back to Dashboard</Link>
            <h1 className="text-2xl font-bold">Offline Log Parser</h1>
            <p className="text-gray-400 text-sm">Analyze large downloaded log files instantly.</p>
         </div>
      </div>
      
      <div className="flex-1 card glass p-0 overflow-hidden">
        <LogParser />
      </div>
    </div>
  );
}
