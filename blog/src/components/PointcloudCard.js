import React from "npm:react";
import htm from "npm:htm";

const html = htm.bind(React.createElement);

export default function PointcloudCard() {
  return html`
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="flex h-[450px] w-[500px] flex-col justify-between rounded-xl border-[4px] border-gray-600 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-800">
          What object is this pointcloud?
        </h1>
        <div className="grid grid-cols-3 gap-4">
          <div className="aspect-square rounded-xl border-[3px] border-gray-600 bg-white"></div>
          <div className="aspect-square rounded-xl border-[3px] border-gray-600 bg-white"></div>
          <div className="aspect-square rounded-xl border-[3px] border-gray-600 bg-white"></div>
        </div>
      </div>
    </div>
  `;
}
