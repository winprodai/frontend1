"use client"

import type React from "react"
// Replace the entire import with a custom implementation
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

interface CategoryFilterProps {
  categories: string[]
  selectedCategory: string
  onChange: (category: string) => void
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({ categories, selectedCategory, onChange }) => {
  return (
    <div className="w-full md:w-64">
      <select
        value={selectedCategory}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
      >
        <option value="all">All Categories</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </div>
  )
}

export default CategoryFilter

