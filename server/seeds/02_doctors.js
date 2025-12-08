exports.seed = async function (knex) {
  // Deletes ALL existing entries
  await knex('doctors').del();

  const doctors = [
    // General Physicians
    { name: "Dr. Arjun Mehta", specialization: "General Physician", experience: 12, qualification: "MBBS, MD", description: "Expert in fever, infections, cold, flu.", fees: 300, image_url: "", available_from: "09:00", available_to: "14:00" },
    { name: "Dr. Priya Sharma", specialization: "General Physician", experience: 8, qualification: "MBBS", description: "Specialist in general treatment & diagnosis.", fees: 250, image_url: "", available_from: "10:00", available_to: "16:00" },
    { name: "Dr. Kiran Shetty", specialization: "General Physician", experience: 15, qualification: "MBBS, MD", description: "Expert in Lifestyle diseases.", fees: 350, available_from: "08:00", available_to: "12:00" },
    { name: "Dr. Rakesh Rao", specialization: "General Physician", experience: 10, qualification: "MBBS", description: "Family doctor consultation", fees: 300, available_from: "11:00", available_to: "17:00" },
    { name: "Dr. Sneha Kulkarni", specialization: "General Physician", experience: 9, qualification: "MBBS", description: "General consultation", fees: 280, available_from: "09:30", available_to: "13:00" },

    // Cardiologists
    { name: "Dr. Harish Menon", specialization: "Cardiologist", experience: 20, qualification: "MBBS, DM Cardiology", description: "Heart issues specialist.", fees: 600, available_from: "10:00", available_to: "15:00" },
    { name: "Dr. Kavitha Rao", specialization: "Cardiologist", experience: 13, qualification: "MBBS, MD", description: "Non-invasive cardiology specialist.", fees: 550, available_from: "09:00", available_to: "13:00" },
    { name: "Dr. Rohit Bhat", specialization: "Cardiologist", experience: 16, qualification: "MBBS, DM", description: "Heart failure & hypertension specialist.", fees: 650, available_from: "11:00", available_to: "17:00" },

    // Dermatologists
    { name: "Dr. Aishwarya Pai", specialization: "Dermatologist", experience: 11, qualification: "MBBS, DDVL", description: "Skin, hair & nail specialist.", fees: 400, available_from: "10:00", available_to: "14:00" },
    { name: "Dr. Chaitra Joshi", specialization: "Dermatologist", experience: 7, qualification: "MBBS, MD", description: "Acne, pigmentation expert.", fees: 350, available_from: "09:00", available_to: "12:00" },

    // Neurology
    { name: "Dr. Sachin Patil", specialization: "Neurologist", experience: 18, qualification: "MBBS, DM Neuro", description: "Brain and nervous disorder specialist.", fees: 700, available_from: "09:00", available_to: "13:00" },
    { name: "Dr. Vaishali Nair", specialization: "Neurologist", experience: 10, qualification: "MBBS, MD", description: "Epilepsy & migraine specialist.", fees: 650, available_from: "10:00", available_to: "15:00" },

    // Orthopedic
    { name: "Dr. Manoj Desai", specialization: "Orthopedic", experience: 14, qualification: "MBBS, MS Ortho", description: "Bone, joint & injury specialist.", fees: 400, available_from: "09:30", available_to: "12:30" },
    { name: "Dr. Ritu Saini", specialization: "Orthopedic", experience: 9, qualification: "MBBS, DNB Ortho", description: "Joint pain & fracture specialist.", fees: 380, available_from: "11:00", available_to: "17:00" },

    // Pediatrician
    { name: "Dr. Anand Kumar", specialization: "Pediatrician", experience: 12, qualification: "MBBS, MD Pediatrics", description: "Child specialist.", fees: 300, available_from: "10:00", available_to: "14:00" },
    { name: "Dr. Shwetha Gowda", specialization: "Pediatrician", experience: 6, qualification: "MBBS, Diploma Pediatrics", description: "Infants & newborn care specialist.", fees: 280, available_from: "09:00", available_to: "13:00" },

    // Gynecologist
    { name: "Dr. Pooja Reddy", specialization: "Gynecologist", experience: 15, qualification: "MBBS, MD", description: "Women's health specialist.", fees: 500, available_from: "10:00", available_to: "16:00" },

    // Dentist
    { name: "Dr. Nikhil Jain", specialization: "Dentist", experience: 8, qualification: "BDS, MDS", description: "Dental surgery and cosmetic dentistry.", fees: 300, available_from: "09:00", available_to: "14:00" }
  ];

  return knex('doctors').insert(doctors);
};
