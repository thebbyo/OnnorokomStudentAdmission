import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="empty">
      <h1>Page not found</h1>
      <p>This address doesn&rsquo;t match any page in the admission portal.</p>
      <Link className="btn btn-primary" to="/">
        Go to the class list
      </Link>
    </div>
  );
}
